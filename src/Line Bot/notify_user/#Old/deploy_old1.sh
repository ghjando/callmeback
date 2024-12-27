#!/bin/bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects list --filter="project_id:$PROJECT_ID" --format="value(project_number)")
DEFAULT_SERVICE_ACCOUNT="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
CLOUD_STORAGE_AGENT="$(gsutil kms serviceaccount -p $PROJECT_ID)"

gcloud projects add-iam-policy-binding $PROJECT_ID --member serviceAccount:$DEFAULT_SERVICE_ACCOUNT --role=roles/eventarc.eventReceiver
gcloud projects add-iam-policy-binding $PROJECT_ID --member serviceAccount:$CLOUD_STORAGE_AGENT --role roles/pubsub.publisher

#### Enable API: (once)
gcloud services enable logging.googleapis.com \
  eventarc.googleapis.com \
  eventarcpublishing.googleapis.com
  
#### Configure variable for convenience (once)(optional / for convenience)
# gcloud config set eventarc/location asia-east1

#### 建立 service account (for Cloud Storage)
SERVICE_ACCOUNT=sa-notify-user@$PROJECT_ID.iam.gserviceaccount.com
SA_LIST=$(gcloud iam service-accounts list --filter="'DISPLAY NAME'='sa-notify-user'" 2>/dev/null|grep "sa-notify-user")
if [ "${SA_LIST}" == "" ]; then
gcloud iam service-accounts create sa-notify-user --display-name="sa-notify-user"
gcloud iam service-accounts keys create ./data/storage_service_account_key.json --iam-account=$SERVICE_ACCOUNT
#### Cloud Storage 授權：使 service account 具有存取特定 bucket 權限 (建立 + 查詢 權限)
BUCKET_URL="gs://${PROJECT_ID}_common_data"
gsutil iam ch serviceAccount:$SERVICE_ACCOUNT:objectViewer,objectCreator $BUCKET_URL
fi

#### docker build
docker build . --tag asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/notify-user

#### docker push
docker push asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/notify-user

#### Deploy CloudRun service:
#gcloud run deploy notify-user --service-account=$SERVICE_ACCOUNT \
gcloud run deploy notify-user \
  --image asia-east1-docker.pkg.dev/$PROJECT_ID/jando-repo/notify-user \
  --update-env-vars PROJECT_ID=$PROJECT_ID \
  --execution-environment gen2

#### 使此 service 具有 run.invoker 角色:
# 只需執行一次
#gcloud run services add-iam-policy-binding notify-user \
#  --member=serviceAccount:$SERVICE_ACCOUNT --role=roles/run.invoker
  
#### 建立 Trigger (是否可指定我們的 service account ? 經過實驗, 失敗)
# 只需執行一次
#gcloud eventarc triggers create common-data-trigger-to-notify-user \
#    --location=asia-east1 \
#    --service-account=$DEFAULT_SERVICE_ACCOUNT \
#    --destination-run-region=asia-east1 \
#    --destination-run-service=notify-user \
#    --destination-run-path="/common_data" \
#    --event-filters="bucket=callme-op-419108_common_data" \
#    --event-filters="type=google.cloud.storage.object.v1.finalized"