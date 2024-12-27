#!/bin/bash
AUTHOR=jando
PROGRAM_NAME=usage-ranking
LOCATION=asia-east1
LIVE_SITE=callme-398802
TRIAL_SITE=callme-op-419108
CMD=node,usage_ranking.js

## Set PROJECT_ID
if [ "$1" == "live" ]; then
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

## Deploy CloudRun jobs:
JOB_LIST=$(gcloud run jobs list --region=$LOCATION \
--format="value(JOB)" 2>/dev/null |grep $PROGRAM_NAME)
if [ "${JOB_LIST}" == "" ]; then
  gcloud run jobs create $PROGRAM_NAME \
    --image ${LOCATION}-docker.pkg.dev/$PROJECT_ID/${AUTHOR}-repo/$PROGRAM_NAME \
    --set-env-vars PROJECT_ID=$PROJECT_ID \
    --set-env-vars DEPLOY_TYPE=cloud_run \
    --command="$CMD" || exit 1
else
  echo job $PROGRAM_NAME already exists
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
