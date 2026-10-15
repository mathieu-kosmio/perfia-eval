VERSION = $(shell cat VERSION)

.PHONY: dev referentiel demo test lint build stage promote schema-import infra-up infra-down infra-logs infra-ps infra-pull infra-validate infra-config infra-kill

## =============================================================================
## SERVEUR DE DÉVELOPPEMENT LOCAL
## =============================================================================

## Télécharger PocketBase dans .local/ si besoin et lancer le serveur de dev (http://127.0.0.1:8090)
dev:
	@./scripts/pb.sh

## Reconstruire le référentiel (web/content/referentiel.json, pb_hooks/referentiel.js, web/js/scoring.js) depuis content/
referentiel:
	@node scripts/build-referentiel.mjs

## Préparer l'instance locale : compte d'équipe et session « demo » (variables lues dans .local/env.sh)
demo:
	@set -a; [ -f .local/env.sh ] && . ./.local/env.sh; set +a; node scripts/seed-demo.mjs

## Importer pocketbase/pb_schema.json dans l'instance locale via l'API (PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD requis)
schema-import:
	@./scripts/import-schema.sh

## =============================================================================
## RACCOURCIS INFRASTRUCTURE (Docker Compose base + overlays, voir infra/deploy/)
## =============================================================================

## Démarrer l'infrastructure locale (en local rien ne tourne dans Docker : voir overlays/local)
infra-up:
	@./infra/deploy/scripts/deploy.sh local up

## Arrêter l'infrastructure locale
infra-down:
	@./infra/deploy/scripts/deploy.sh local down

## Suivre les journaux de l'infrastructure
infra-logs:
	@./infra/deploy/scripts/deploy.sh local logs

## Afficher l'état de l'infrastructure
infra-ps:
	@./infra/deploy/scripts/deploy.sh local ps

## Récupérer les dernières images
infra-pull:
	@./infra/deploy/scripts/deploy.sh local pull

## Valider la configuration de l'infrastructure
infra-validate:
	@./infra/deploy/scripts/deploy.sh local validate

## Afficher la configuration fusionnée de l'infrastructure
infra-config:
	@./infra/deploy/scripts/deploy.sh local config

## Tuer et supprimer TOUS les conteneurs et réseaux du projet
infra-kill:
	@./infra/deploy/scripts/deploy.sh local kill

## =============================================================================
## CIBLES DE BUILD (déléguées à infra/make/make_app.mk)
## =============================================================================

## Vérifier le Dockerfile (hadolint)
lint:
	@$(MAKE) -f infra/make/make_app.mk lint

## Construire l'image Docker de l'application
build:
	@$(MAKE) -f infra/make/make_app.mk build

## Lancer les tests (instance PocketBase jetable + node --test tests/)
test:
	@$(MAKE) -f infra/make/make_app.mk test

## Publier (stage) l'image sur le registre
stage: publish

publish:
	@$(MAKE) -f infra/make/make_app.mk stage

## Promouvoir l'image
promote:
	@$(MAKE) -f infra/make/make_app.mk promote
