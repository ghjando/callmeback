#!/bin/bash
PROGRAM_NAME=notify-user
PORT=3000
PROJECT_ID=$(gcloud config get-value project)

## Create cloud storage bucket "COMMON_DATA_BUCKET"
## todo - add callnum_log, usage_log, shop_history
COMMON_DATA_BUCKET=${PROJECT_ID}_common_data
BK_list=$(gcloud storage buckets list gs://$COMMON_DATA_BUCKET --format="value(name)" 2>/dev/null)
if [ "${BK_list}" == "" ]; then
  gcloud storage buckets create gs://$COMMON_DATA_BUCKET --location=asia-east1 --uniform-bucket-level-access
else
  echo bucket $COMMON_DATA_BUCKET already exists
fi

## Create service account (for Cloud Storage)
SERVICE_ACCOUNT_NAME=sa-${PROGRAM_NAME}
SERVICE_ACCOUNT=$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com
SA_LIST=$(gcloud iam service-accounts list --filter="'DISPLAY NAME':sa-${PROGRAM_NAME}" \
  --format="value('DISPLAY NAME')" 2>/dev/null)
if [ "${SA_LIST}" == "" ]; then
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME --display-name=$SERVICE_ACCOUNT_NAME
gcloud iam service-accounts keys create ./data/storage_service_account_key.json --iam-account=$SERVICE_ACCOUNT
## Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (建立 + 查詢 權限)
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectViewer,objectCreator gs://$COMMON_DATA_BUCKET
else
  echo serviceAccount $SERVICE_ACCOUNT_NAME already exists
fi

## docker build
docker build . --tag asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/$PROGRAM_NAME

## docker run
docker rm -f $PROGRAM_NAME
docker run --env PROJECT_ID=$PROJECT_ID -d -p 80:$PORT --name $PROGRAM_NAME asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/$PROGRAM_NAME