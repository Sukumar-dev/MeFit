FROM quay.io/keycloak/keycloak:26.8.2

ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true

COPY infra/keycloak-prod/mefit-realm.json /opt/keycloak/data/import/mefit-realm.json
COPY infra/keycloak-prod/entrypoint.sh /opt/keycloak/entrypoint.sh
RUN microdnf install -y curl jq && microdnf clean all && chmod +x /opt/keycloak/entrypoint.sh

RUN /opt/keycloak/bin/kc.sh build --db=postgres

ENTRYPOINT ["/opt/keycloak/entrypoint.sh"]
CMD ["start", "--optimized", "--import-realm"]
