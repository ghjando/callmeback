#!/bin/bash
## todo - add AUTHOR, LOCATION
PROGRAM_NAME=query-mainpi
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects list --filter="project_id:$PROJECT_ID" --format="value(project_number)")
DEFAULT_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
CLOUD_STORAGE_AGENT="$(gsutil kms serviceaccount -p $PROJECT_ID)"

## Create service account & ./data/storage_service_account_key.json
SERVICE_ACCOUNT_NAME=sa-${PROGRAM_NAME}
SERVICE_ACCOUNT=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com
SA_LIST=$(gcloud iam service-accounts list --filter="'DISPLAY NAME':sa-${PROGRAM_NAME}" \
  --format="value('DISPLAY NAME')" 2>/dev/null)
if [ "${SA_LIST}" == "" ]; then
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME --display-name=$SERVICE_ACCOUNT_NAME
  gcloud iam service-accounts keys create ./data/storage_service_account_key.json --iam-account=$SERVICE_ACCOUNT
else
  echo serviceAccount $SERVICE_ACCOUNT_NAME already exists
fi

## Create cloud storage bucket "COMMON_DATA_BUCKET"
COMMON_DATA_BUCKET=${PROJECT_ID}_common_data
BK_list=$(gcloud storage buckets list gs://$COMMON_DATA_BUCKET --format="value(name)" 2>/dev/null)
if [ "${BK_list}" == "" ]; then
  gcloud storage buckets create gs://$COMMON_DATA_BUCKET --location=asia-east1 --uniform-bucket-level-access
else
  echo bucket $COMMON_DATA_BUCKET already exists
fi
## Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (建立 + 查詢 權限)
## gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectViewer,objectCreator gs://$COMMON_DATA_BUCKET

## Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (新增、刪除、修改、查詢 權限)
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectUser gs://$COMMON_DATA_BUCKET

## todo - Create image repository (for docker)
#gcloud artifacts repositories create jando-repo --location=asia-east1 --repository-format=docker
## docker build
docker build . --tag asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/$PROGRAM_NAME
## docker push
docker push asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/$PROGRAM_NAME

## Deploy CloudRun service:
# Use "storage_service_account_key.json" instead of "setting service-account"
#gcloud run deploy $PROGRAM_NAME --service-account=$SERVICE_ACCOUNT \ 
gcloud run deploy $PROGRAM_NAME \
  --image asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/$PROGRAM_NAME \
  --update-env-vars PROJECT_ID=$PROJECT_ID \
  --update-env-vars DEPLOY_TYPE=cloud_run \
  --port=3000 \
  --execution-environment gen2

## Enable eventarc related API
gcloud services enable logging.googleapis.com \
  eventarc.googleapis.com \
  eventarcpublishing.googleapis.com

## Enable Cloud Storage to be "pubsub.publisher" role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member serviceAccount:$CLOUD_STORAGE_AGENT --role roles/pubsub.publisher \
  |grep roles/pubsub.publisher

## Enable DEFAULT_SERVICE_ACCOUNT to be "eventarc.eventReceiver" role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member serviceAccount:$DEFAULT_SERVICE_ACCOUNT --role=roles/eventarc.eventReceiver \
  |grep roles/eventarc.eventReceiver

## Enable SERVICE_ACCOUNT to be "run.invoker" role
gcloud run services add-iam-policy-binding $PROGRAM_NAME \
  --member=serviceAccount:$SERVICE_ACCOUNT --role=roles/run.invoker \
  |grep roles/run.invoker

## Create trigger
TRIGGER_NAME=common-data-trigger-to-${PROGRAM_NAME}
TRIGGER_LIST=$(gcloud eventarc triggers list --location=asia-east1 --filter="name:$TRIGGER_NAME" \
  --format="value(name)" 2>/dev/null)
if [ "${TRIGGER_LIST}" == "" ]; then
  gcloud eventarc triggers create $TRIGGER_NAME \
    --location=asia-east1 \
    --service-account=$DEFAULT_SERVICE_ACCOUNT \
    --destination-run-region=asia-east1 \
    --destination-run-service=$PROGRAM_NAME \
    --destination-run-path="/common_data" \
    --event-filters="bucket=$COMMON_DATA_BUCKET" \
    --event-filters="type=google.cloud.storage.object.v1.finalized"
else
  echo trigger $TRIGGER_NAME already exists
fi

## Create schedule
JOB_NAME=job_1m
SERVICE_URL=$(gcloud run services list --filter="SERVICE:$PROGRAM_NAME" --format="value(URL)" 2>/dev/null)
if [ "${SERVICE_URL}" != "" ]; then
  JOB_LIST=$(gcloud scheduler jobs list --location=asia-east1 --filter="ID:${PROGRAM_NAME}_${JOB_NAME}" --format="value(ID)" 2>/dev/null)
  if [ "${JOB_LIST}" == "" ]; then
    gcloud scheduler jobs create http ${PROGRAM_NAME}_${JOB_NAME} --schedule "* * * * *" \
      --http-method=GET --uri=$SERVICE_URL/$JOB_NAME \
      --oidc-service-account-email=$SERVICE_ACCOUNT \
      --location=asia-east1 \
      --time-zone="Asia/Taipei" \
      |grep ${PROGRAM_NAME}_${JOB_NAME}
  else    
    echo job ${PROGRAM_NAME}_${JOB_NAME} already exists
  fi
else
  echo service $PROGRAM_NAME not exists
fi
