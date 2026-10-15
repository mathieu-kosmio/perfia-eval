VERSION = $(shell cat VERSION)

PERFIA_APP_DOCKERFILE	:= infra/docker/app/Dockerfile
PROJECT_SLUG			:= $(shell grep '^PROJECT_SLUG=' infra/deploy/base/.env.base | cut -d'=' -f2)
PERFIA_APP_NAME		:= ${PROJECT_SLUG}-app
PERFIA_APP_IMG		:= ${PERFIA_APP_NAME}:${VERSION}

.PHONY: lint build test stage promote

## Vérifier le Dockerfile avec hadolint
lint: docker-perfia-app-lint

## Construire l'image Docker de l'application
build: docker-perfia-app-build

## Lancer les tests sur une instance PocketBase jetable
test:
	@./scripts/test.sh

## Publier l'image sur le registre (CI_REGISTRY_URL)
stage: docker-perfia-app-stage

## Promotion : rien à faire, l'image est taguée par version (penser à incrémenter VERSION avant un déploiement)
promote:
	@echo 'Rien à promouvoir'

docker-perfia-app-lint:
	@docker run --rm -i hadolint/hadolint hadolint - < ${PERFIA_APP_DOCKERFILE}

docker-perfia-app-build:
	@docker build --no-cache=true \
		-f ${PERFIA_APP_DOCKERFILE} -t ${PERFIA_APP_IMG} .

docker-perfia-app-stage:
	@docker tag ${PERFIA_APP_IMG} ${CI_REGISTRY_URL}/${PERFIA_APP_IMG}
	@docker push ${CI_REGISTRY_URL}/${PERFIA_APP_IMG}
