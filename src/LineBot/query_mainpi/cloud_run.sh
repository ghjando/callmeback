#!/bin/bash
if [ "$1" == "live" ]; then
  DPLOY_SITE=live
  CPU_ALWAYS_ON=true
else
  DPLOY_SITE=trial
  CPU_ALWAYS_ON=false
fi

DPLOY_TYPE=cloud_run
PROGRAM_NAME=query-mainpi
PORT=3200
COMMON_DATA_TRIGGER=true
JOB_1H=true
JOB_1M=true

../deploy.sh $DPLOY_SITE $DPLOY_TYPE $PROGRAM_NAME $PORT $CPU_ALWAYS_ON $COMMON_DATA_TRIGGER $JOB_1H $JOB_1M
