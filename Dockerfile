FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/.github /usr/share/nginx/html/tests /usr/share/nginx/html/deploy /usr/share/nginx/html/scripts /usr/share/nginx/html/.git
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
