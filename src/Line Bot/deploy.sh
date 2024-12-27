#!/bin/bash
AUTHOR=jando
LOCATION=asia-east1
LIVE_SITE=callme-398802
TRIAL_SITE=callme-op-419108

DPLOY_SITE=$1
DPLOY_TYPE=$2
PROGRAM_NAME=$3
PORT=$4
CPU_ALWAYS_ON=$5
COMMON_DATA_TRIGGER=$6
JOB_1H=$7
JOB_1M=$8

## Set PROJECT_ID
if [ "$DPLOY_SITE" == "live" ]; then
  PROJECT_ID=$LIVE_SITE
else
  PROJECT_ID=$TRIAL_SITE
fi

## Change current project to PROJECT_ID
CUR_PROJECT=$(gcloud config get-value project)
echo Current project is $CUR_PROJECT
if [ "$CUR_PROJECT" != "$PROJECT_ID" ]; then
  gcloud config set project $PROJECT_ID
  CUR_PROJECT=$(gcloud config get-value project)
  if [ "$CUR_PROJECT" == "$PROJECT_ID" ]; then
    echo change project to $PROJECT_ID
  else
    echo Failed to change project to $PROJECT_ID
    exit 1
  fi
fi

PROJECT_NUMBER=$(gcloud projects list --filter="project_id:$PROJECT_ID" --format="value(project_number)")
DEFAULT_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
CLOUD_STORAGE_AGENT="$(gsutil kms serviceaccount -p $PROJECT_ID)"

## Create service account
SERVICE_ACCOUNT_NAME=sa-${PROGRAM_NAME}
SERVICE_ACCOUNT=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com
SA_LIST=$(gcloud iam service-accounts list --filter="'DISPLAY NAME':$SERVICE_ACCOUNT_NAME" \
  --format="value('DISPLAY NAME')" 2>/dev/null)
if [ "${SA_LIST}" == "" ]; then
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME --display-name=$SERVICE_ACCOUNT_NAME || exit 1
else
  echo serviceAccount $SERVICE_ACCOUNT_NAME already exists
fi

## Create ./data/${PROJECT_ID}/storage_service_account_key.json
if [ -e ./data/${PROJECT_ID}/storage_service_account_key.json ]; then
  echo storage_service_account_key.json already exists
else
  echo get storage_service_account_key.json
  gcloud iam service-accounts keys create ./data/${PROJECT_ID}/storage_service_account_key.json \
  --iam-account=$SERVICE_ACCOUNT || exit 1
fi

## Create cloud storage bucket "COMMON_DATA_BUCKET"
COMMON_DATA_BUCKET=${PROJECT_ID}_common_data
BK_list=$(gcloud storage buckets list gs://$COMMON_DATA_BUCKET --format="value(name)" 2>/dev/null)
if [ "${BK_list}" == "" ]; then
  gcloud storage buckets create gs://$COMMON_DATA_BUCKET --location=$LOCATION --uniform-bucket-level-access || exit 1
else
  echo bucket $COMMON_DATA_BUCKET already exists
fi
## Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (建立 + 查詢 權限)
## gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectViewer,objectCreator gs://$COMMON_DATA_BUCKET

## Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (新增、刪除、修改、查詢 權限)
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectUser gs://$COMMON_DATA_BUCKET || exit 1

## docker build
docker build . --tag ${LOCATION}-docker.pkg.dev/$PROJECT_ID/${AUTHOR}-repo/$PROGRAM_NAME || exit 1

## Create GCP image repository
REPO_LIST=$(gcloud artifacts repositories list --location=$LOCATION \
--filter="REPOSITORY:${AUTHOR}-repo" \
--format="value(REPOSITORY)" 2>/dev/null)
if [ "${REPO_LIST}" == "" ]; then
  gcloud artifacts repositories create ${AUTHOR}-repo --location=$LOCATION --repository-format=docker || exit 1
else
  echo repository ${AUTHOR}-repo already exists
fi

## Push docker to GCP image repository
docker push ${LOCATION}-docker.pkg.dev/$PROJECT_ID/${AUTHOR}-repo/$PROGRAM_NAME || exit 1

## Deploy CloudRun service:
# Use "storage_service_account_key.json" instead of "setting service-account"
#(Old)gcloud run deploy $PROGRAM_NAME --service-account=$SERVICE_ACCOUNT \
if [ "${CPU_ALWAYS_ON}" == "true" ]; then
  CPU_SETTING=--no-cpu-throttling
else
  CPU_SETTING=--cpu-throttling
fi 
gcloud beta run deploy $PROGRAM_NAME \
  --image ${LOCATION}-docker.pkg.dev/$PROJECT_ID/${AUTHOR}-repo/$PROGRAM_NAME \
  --update-env-vars PROJECT_ID=$PROJECT_ID \
  --update-env-vars DEPLOY_TYPE=cloud_run \
  --port=$PORT \
  --service-min-instances=1 \
  $CPU_SETTING \
  --execution-environment gen2 || exit 1

## Enable eventarc related API
SERVICE_LIST=$(gcloud services list --enabled --filter="NAME:logging.googleapis.com" --format="value('NAME')" 2>/dev/null)
if [ "${SERVICE_LIST}" == "" ]; then
  gcloud services enable logging.googleapis.com || exit 1
else
  echo logging.googleapis.com already enabled
fi
SERVICE_LIST=$(gcloud services list --enabled --filter="NAME:eventarc.googleapis.com" --format="value('NAME')" 2>/dev/null)
if [ "${SERVICE_LIST}" == "" ]; then
  gcloud services enable eventarc.googleapis.com || exit 1
else
  echo eventarc.googleapis.com already enabled
fi
SERVICE_LIST=$(gcloud services list --enabled --filter="NAME:eventarcpublishing.googleapis.com" --format="value('NAME')" 2>/dev/null)
if [ "${SERVICE_LIST}" == "" ]; then
  gcloud services enable eventarcpublishing.googleapis.com || exit 1
else
  echo eventarcpublishing.googleapis.com already enabled
fi

## Enable Cloud Storage to be "pubsub.publisher" role
ROLE_LIST=$(gcloud projects get-iam-policy $PROJECT_ID|grep -e serviceAccount -e roles/pubsub.publisher|grep -B 1 roles/pubsub.publisher|grep $CLOUD_STORAGE_AGENT)
if [ "${ROLE_LIST}" == "" ]; then
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member serviceAccount:$CLOUD_STORAGE_AGENT --role roles/pubsub.publisher \
    |grep -B 1 roles/pubsub.publisher || exit 1
else
  echo $CLOUD_STORAGE_AGENT
  echo roles/pubsub.publisher already exists
fi

## Enable DEFAULT_SERVICE_ACCOUNT to be "eventarc.eventReceiver" role
ROLE_LIST=$(gcloud projects get-iam-policy $PROJECT_ID|grep -e serviceAccount -e roles/eventarc.eventReceiver|grep -B 1 roles/eventarc.eventReceiver|grep $DEFAULT_SERVICE_ACCOUNT)
if [ "${ROLE_LIST}" == "" ]; then
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member serviceAccount:$DEFAULT_SERVICE_ACCOUNT --role=roles/eventarc.eventReceiver \
    |grep -B 1 roles/eventarc.eventReceiver || exit 1
else
  echo $DEFAULT_SERVICE_ACCOUNT
  echo roles/eventarc.eventReceiver already exists
fi

## Enable SERVICE_ACCOUNT to be "run.invoker" role
ROLE_LIST=$(gcloud run services get-iam-policy $PROGRAM_NAME|grep -e serviceAccount -e roles/run.invoker|grep -B 1 roles/run.invoker|grep $SERVICE_ACCOUNT)
if [ "${ROLE_LIST}" == "" ]; then
  gcloud run services add-iam-policy-binding $PROGRAM_NAME \
    --member=serviceAccount:$SERVICE_ACCOUNT --role=roles/run.invoker \
    |grep -B 1 roles/run.invoker || exit 1
else
  echo $SERVICE_ACCOUNT
  echo roles/run.invoker already exists
fi

## Create trigger and schedule
SERVICE_URL=$(gcloud run services list --filter="SERVICE:$PROGRAM_NAME" --format="value(URL)" 2>/dev/null)
if [ "${SERVICE_URL}" == "" ]; then
  echo service $PROGRAM_NAME not exists
else
  ## Create trigger "common-data-trigger"
  if [ "${COMMON_DATA_TRIGGER}" == "true" ]; then
    TRIGGER_NAME=common-data-trigger-to-${PROGRAM_NAME}
    TRIGGER_LIST=$(gcloud eventarc triggers list --location=$LOCATION --filter="name:$TRIGGER_NAME" \
      --format="value(name)" 2>/dev/null)
    if [ "${TRIGGER_LIST}" == "" ]; then
      gcloud eventarc triggers create $TRIGGER_NAME \
        --location=$LOCATION \
        --service-account=$DEFAULT_SERVICE_ACCOUNT \
        --destination-run-region=$LOCATION \
        --destination-run-service=$PROGRAM_NAME \
        --destination-run-path="/common_data" \
        --event-filters="bucket=$COMMON_DATA_BUCKET" \
        --event-filters="type=google.cloud.storage.object.v1.finalized" || exit 1
    else
      echo trigger $TRIGGER_NAME already exists
    fi
  fi  

  ## Create schedule "job_1h"
  if [ "${JOB_1H}" == "true" ]; then
    JOB_NAME=job_1h
    JOB_LIST=$(gcloud scheduler jobs list --location=$LOCATION --filter="ID:${PROGRAM_NAME}_${JOB_NAME}" --format="value(ID)" 2>/dev/null)
    if [ "${JOB_LIST}" == "" ]; then
      gcloud scheduler jobs create http ${PROGRAM_NAME}_${JOB_NAME} --schedule "0 * * * *" \
        --http-method=GET --uri=$SERVICE_URL/$JOB_NAME \
        --oidc-service-account-email=$SERVICE_ACCOUNT \
        --location=$LOCATION \
        --time-zone="Asia/Taipei" \
        |grep ${PROGRAM_NAME}_${JOB_NAME} || exit 1
    else    
      echo job ${PROGRAM_NAME}_${JOB_NAME} already exists
    fi
  fi

  ## Create schedule "job_1m"
  if [ "${JOB_1M}" == "true" ]; then
    JOB_NAME=job_1m
    JOB_LIST=$(gcloud scheduler jobs list --location=$LOCATION --filter="ID:${PROGRAM_NAME}_${JOB_NAME}" --format="value(ID)" 2>/dev/null)
    if [ "${JOB_LIST}" == "" ]; then
      gcloud scheduler jobs create http ${PROGRAM_NAME}_${JOB_NAME} --schedule "* * * * *" \
        --http-method=GET --uri=$SERVICE_URL/$JOB_NAME \
        --oidc-service-account-email=$SERVICE_ACCOUNT \
        --location=$LOCATION \
        --time-zone="Asia/Taipei" \
        |grep ${PROGRAM_NAME}_${JOB_NAME} || exit 1
    else    
      echo job ${PROGRAM_NAME}_${JOB_NAME} already exists
    fi
  fi
fi

## Change current project to TRIAL_SITE
CUR_PROJECT=$(gcloud config get-value project)
echo Current project is $CUR_PROJECT
if [ "$CUR_PROJECT" != "$TRIAL_SITE" ]; then
  gcloud config set project $TRIAL_SITE
  CUR_PROJECT=$(gcloud config get-value project)
  if [ "$CUR_PROJECT" == "$TRIAL_SITE" ]; then
    echo change project to $TRIAL_SITE
  else
    echo Failed to change project to $TRIAL_SITE
    exit 1
  fi
fi
