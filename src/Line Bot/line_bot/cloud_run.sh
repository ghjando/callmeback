#!/bin/bash
if [ "$1" == "live" ]; then
  DPLOY_SITE=live
else
  DPLOY_SITE=trial
fi

DPLOY_TYPE=cloud_run
PROGRAM_NAME=line-bot
PORT=3000
CPU_ALWAYS_ON=false
COMMON_DATA_TRIGGER=true
JOB_1H=true
JOB_1M=false

../deploy.sh $DPLOY_SITE $DPLOY_TYPE $PROGRAM_NAME $PORT $CPU_ALWAYS_ON $COMMON_DATA_TRIGGER $JOB_1H $JOB_1M
