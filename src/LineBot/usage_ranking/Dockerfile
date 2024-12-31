FROM node:18.19.0
ENV DEPLOY_TYPE="docker_run"
EXPOSE 3000
WORKDIR /var/call_me/usage_ranking
COPY . ./
RUN mkdir ../download
RUN mkdir ../common_data
RUN mkdir ../common_data/callnum_log
RUN mkdir ../common_data/usage_log
RUN mkdir ../common_data/shop_history
RUN npm install
CMD ["node", "usage_ranking.js"]
