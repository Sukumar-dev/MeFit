FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY . .
ARG VITE_API_URL
ARG VITE_OIDC_AUTHORITY
ARG VITE_OIDC_CLIENT_ID=mefit-web
ARG VITE_OIDC_REDIRECT_URI
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OIDC_AUTHORITY=$VITE_OIDC_AUTHORITY
ENV VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID
ENV VITE_OIDC_REDIRECT_URI=$VITE_OIDC_REDIRECT_URI
RUN test -n "$VITE_API_URL" \
  && test -n "$VITE_OIDC_AUTHORITY" \
  && test -n "$VITE_OIDC_REDIRECT_URI" \
  && npm run build --workspace apps/web

FROM nginxinc/nginx-unprivileged:alpine
COPY apps/web/deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
