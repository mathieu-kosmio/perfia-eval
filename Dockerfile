# PerfIA Diagnostic IA : PocketBase + hooks + migrations + interface web dans une seule image.
# Les données (SQLite, fichiers, sauvegardes) vivent dans le volume /pb/pb_data.
#
# ATTENTION : ce fichier et infra/docker/app/Dockerfile doivent rester IDENTIQUES.
# Celui-ci sert à Coolify (build depuis la racine du dépôt) ; l'autre sert à la CI
# et au Makefile. Toute modification doit être reportée dans les deux.
FROM alpine:3.23

ARG PB_VERSION=0.40.6
# Empreintes SHA-256 de l'archive officielle (checksums.txt de la release). À mettre à jour avec PB_VERSION.
ARG PB_SHA256_AMD64=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f
ARG PB_SHA256_ARM64=d22c66ceb67ca92b7d767f36d826e848a276bcfa3c197ead20bf87c42208984f
ARG TARGETARCH=amd64

# hadolint ignore=DL3018
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
 && case "$TARGETARCH" in amd64) sum="$PB_SHA256_AMD64" ;; arm64) sum="$PB_SHA256_ARM64" ;; *) echo "Architecture non prise en charge : $TARGETARCH" >&2; exit 1 ;; esac \
 && echo "$sum  /tmp/pb.zip" > /tmp/pb.zip.sha256 && sha256sum -c /tmp/pb.zip.sha256 \
 && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip /tmp/pb.zip.sha256 \
 && apk del unzip

COPY pocketbase/pb_hooks        /pb/pb_hooks
COPY pocketbase/pb_migrations   /pb/pb_migrations
COPY pocketbase/pb_schema.json  /pb/pb_schema.json
COPY web                        /pb/pb_public

WORKDIR /pb
EXPOSE 8090
VOLUME ["/pb/pb_data"]

# wget (BusyBox) reste disponible pour le healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8090/api/health"]

CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--hooksDir=/pb/pb_hooks", "--migrationsDir=/pb/pb_migrations", "--publicDir=/pb/pb_public"]
