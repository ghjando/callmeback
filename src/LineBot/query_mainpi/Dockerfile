FROM node:18.19.0
ENV DEPLOY_TYPE="docker_run"
EXPOSE 3200
WORKDIR /var/call_me/query_mainpi
COPY . ./
RUN mkdir ../download
RUN mkdir ../common_data
RUN mkdir ../common_data/shop_data
RUN mkdir ../common_data/callnum_log
RUN mkdir ../common_data/usage_log
RUN mkdir ../common_data/shop_history
RUN npm install
CMD ["node", "query_mainpi.js"]
