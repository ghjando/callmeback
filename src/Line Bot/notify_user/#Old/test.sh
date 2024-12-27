#!/bin/bash
PROGRAM_NAME=notify-user
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects list --filter="project_id:$PROJECT_ID" --format="value(project_number)")
DEFAULT_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
SERVICE_ACCOUNT=sa-${PROGRAM_NAME}@$PROJECT_ID.iam.gserviceaccount.com

gcloud run services add-iam-policy-binding $PROGRAM_NAME \
  --member=serviceAccount:$SERVICE_ACCOUNT --role=roles/run.invoker

# 建立 bucket "${PROJECT_ID}_common_data"
CS_list=$(gcloud storage buckets list gs://${PROJECT_ID}_common_data --format="value(name)" 2>/dev/null)
if [ "${CS_list}" == "" ]; then
  gcloud storage buckets create gs://${PROJECT_ID}_common_data --location=asia-east1 --uniform-bucket-level-access
else
  echo ${PROJECT_ID}_common_data already exist!
fi

# 建立 trigger "common-data-trigger-to-${PROGRAM_NAME}"
TRIGGER_LIST=$(gcloud eventarc triggers list --location=asia-east1 --filter="name:common-data-trigger-to-${PROGRAM_NAME}" \
  --format="value(name)" 2>/dev/null)
if [ "${TRIGGER_LIST}" == "" ]; then
gcloud eventarc triggers create common-data-trigger-to-${PROGRAM_NAME} \
    --location=asia-east1 \
    --service-account=$DEFAULT_SERVICE_ACCOUNT \
    --destination-run-region=asia-east1 \
    --destination-run-service=$PROGRAM_NAME \
    --destination-run-path="/common_data" \
    --event-filters="bucket=${PROJECT_ID}_common_data" \
    --event-filters="type=google.cloud.storage.object.v1.finalized"
else
  echo common-data-trigger-to-${PROGRAM_NAME} already exist!
fi
