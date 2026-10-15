#!/bin/bash
set -euo pipefail

# =============================================================================
# Script de déploiement unifié pour PerfIA Diagnostic IA (PocketBase + Traefik)
# =============================================================================
# Usage : ./deploy.sh <environnement> <action> [options]
#
# Environnements : local, dev, prod
# Actions : up, down, logs, ps, pull, restart, config, validate, kill
#
# Options :
#   --skip-services <svc1,svc2>  Ignorer certains services (séparés par des virgules, pour up/pull)
#
# Exemples :
#   ./deploy.sh local validate     # Vérifier la configuration locale (rien ne tourne en local)
#   ./deploy.sh dev up             # Déployer sur dev
#   ./deploy.sh prod pull          # Récupérer les dernières images pour prod
#   ./deploy.sh dev logs           # Suivre les journaux
#   ./deploy.sh dev kill           # Tuer et supprimer de force tous les conteneurs/réseaux
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENVIRONMENT=${1:-local}
ACTION=${2:-up}
shift 2 || true

# Analyse des options
SKIP_SERVICES=""
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-services)
      SKIP_SERVICES="$2"
      shift 2
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

# Validation de l'environnement
VALID_ENVIRONMENTS=("local" "dev" "prod")
if [[ ! " ${VALID_ENVIRONMENTS[*]} " =~ " ${ENVIRONMENT} " ]]; then
  echo "Erreur : environnement invalide '$ENVIRONMENT'"
  echo "Environnements valides : ${VALID_ENVIRONMENTS[*]}"
  exit 1
fi

# Chemins
COMPOSE_BASE="$BASE_DIR/base/docker-compose.base.yml"
COMPOSE_OVERLAY="$BASE_DIR/overlays/$ENVIRONMENT/docker-compose.override.yml"

# Fichiers d'environnement : valeurs de base + overlay propre à l'environnement
ENV_BASE="$BASE_DIR/base/.env.base"
if [[ -n "${DOCKER_COMPOSE_ENV_FILE:-}" ]]; then
  ENV_FILE="$DOCKER_COMPOSE_ENV_FILE"
else
  ENV_FILE="$BASE_DIR/overlays/$ENVIRONMENT/.env.$ENVIRONMENT"
fi

# Extraction de PROJECT_SLUG depuis le fichier d'environnement de base
PROJECT_SLUG=$(grep "^PROJECT_SLUG=" "$ENV_BASE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "perfia-eval")
export PROJECT_SLUG

# Vérification de l'existence des fichiers
if [[ ! -f "$COMPOSE_BASE" ]]; then
  echo "Erreur : fichier compose de base introuvable : $COMPOSE_BASE"
  exit 1
fi

if [[ ! -f "$COMPOSE_OVERLAY" ]]; then
  echo "Erreur : fichier compose d'overlay introuvable : $COMPOSE_OVERLAY"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erreur : fichier d'environnement introuvable : $ENV_FILE"
  exit 1
fi

# Construction de la commande compose
compose_cmd() {
  local env_args=()
  if [[ -f "$ENV_BASE" ]]; then
    env_args+=(--env-file "$ENV_BASE")
  fi
  env_args+=(--env-file "$ENV_FILE")

  docker compose \
    -f "$COMPOSE_BASE" \
    -f "$COMPOSE_OVERLAY" \
    "${env_args[@]}" \
    --project-name "${PROJECT_SLUG}-$ENVIRONMENT" \
    "$@"
}

# Résolution des services, en excluant ceux passés à --skip-services
resolve_services() {
  if [[ -z "$SKIP_SERVICES" ]]; then
    return
  fi
  local all_services
  all_services=$(compose_cmd config --services)
  IFS=',' read -ra skip_array <<< "$SKIP_SERVICES"
  local services=()
  while IFS= read -r svc; do
    local skip=false
    for s in "${skip_array[@]}"; do
      if [[ "$svc" == "$s" ]]; then
        skip=true
        break
      fi
    done
    if ! $skip; then
      services+=("$svc")
    fi
  done <<< "$all_services"
  echo "${services[@]}"
}

# Affichage de la configuration courante
show_info() {
  echo "============================================="
  echo "Déploiement ${PROJECT_SLUG}"
  echo "============================================="
  echo "Environnement : $ENVIRONMENT"
  echo "Action : $ACTION"
  echo "Base : $COMPOSE_BASE"
  echo "Overlay : $COMPOSE_OVERLAY"
  echo "Fichier d'env : $ENV_FILE"
  echo "============================================="
}

# Actions principales
case "$ACTION" in
  up)
    show_info
    SERVICES=$(resolve_services)
    if [[ -n "$SKIP_SERVICES" ]]; then
      echo "Démarrage des services pour $ENVIRONMENT (ignorés : $SKIP_SERVICES)..."
    else
      echo "Démarrage des services pour $ENVIRONMENT..."
    fi
    NO_DEPS=""
    if [[ -n "$SKIP_SERVICES" ]]; then
      NO_DEPS="--no-deps"
    fi
    # shellcheck disable=SC2086
    compose_cmd up -d $NO_DEPS $SERVICES ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    echo "Services démarrés. Utiliser './deploy.sh $ENVIRONMENT ps' pour voir l'état."
    ;;

  down)
    show_info
    echo "Arrêt des services pour $ENVIRONMENT..."
    compose_cmd down ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    echo "Services arrêtés."
    ;;

  logs)
    compose_cmd logs -f ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  ps)
    compose_cmd ps ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  pull)
    show_info
    SERVICES=$(resolve_services)
    if [[ -n "$SKIP_SERVICES" ]]; then
      echo "Récupération des images pour $ENVIRONMENT (ignorés : $SKIP_SERVICES)..."
    else
      echo "Récupération des images pour $ENVIRONMENT..."
    fi
    # shellcheck disable=SC2086
    compose_cmd pull $SERVICES ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    echo "Images récupérées."
    ;;

  restart)
    show_info
    echo "Redémarrage des services pour $ENVIRONMENT..."
    compose_cmd restart ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    echo "Services redémarrés."
    ;;

  config)
    echo "Configuration fusionnée pour $ENVIRONMENT :"
    compose_cmd config ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}
    ;;

  validate)
    echo "Validation de la configuration pour $ENVIRONMENT..."
    if compose_cmd config --quiet ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}; then
      echo "Configuration valide."
    else
      echo "La configuration contient des erreurs."
      exit 1
    fi
    ;;

  kill)
    show_info
    echo "ATTENTION : tous les conteneurs de $ENVIRONMENT vont être tués et supprimés de force"
    echo "Ctrl+C dans les 5 secondes pour annuler..."
    sleep 5

    PROJECT_NAME="${PROJECT_SLUG}-$ENVIRONMENT"

    RUNNING_CONTAINERS=$(docker ps --filter "label=com.docker.compose.project=$PROJECT_NAME" -q)
    if [[ -n "$RUNNING_CONTAINERS" ]]; then
      CONTAINER_NAMES=$(docker ps --filter "label=com.docker.compose.project=$PROJECT_NAME" --format '{{.Names}}' | tr '\n' ', ' | sed 's/,$//')
      echo "Arrêt forcé des conteneurs : $CONTAINER_NAMES"
      # shellcheck disable=SC2086
      docker kill $RUNNING_CONTAINERS
    else
      echo "Aucun conteneur en cours d'exécution pour le projet : $PROJECT_NAME"
    fi

    ALL_CONTAINERS=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT_NAME" -q)
    if [[ -n "$ALL_CONTAINERS" ]]; then
      CONTAINER_NAMES=$(docker ps -a --filter "label=com.docker.compose.project=$PROJECT_NAME" --format '{{.Names}}' | tr '\n' ', ' | sed 's/,$//')
      echo "Suppression des conteneurs : $CONTAINER_NAMES"
      # shellcheck disable=SC2086
      docker rm -f $ALL_CONTAINERS
    else
      echo "Aucun conteneur à supprimer pour le projet : $PROJECT_NAME"
    fi

    PROJECT_NETWORKS=$(docker network ls --filter "label=com.docker.compose.project=$PROJECT_NAME" -q)
    if [[ -n "$PROJECT_NETWORKS" ]]; then
      NETWORK_NAMES=$(docker network ls --filter "label=com.docker.compose.project=$PROJECT_NAME" --format '{{.Name}}' | tr '\n' ', ' | sed 's/,$//')
      echo "Suppression des réseaux : $NETWORK_NAMES"
      # shellcheck disable=SC2086
      docker network rm $PROJECT_NETWORKS 2>/dev/null || echo "Certains réseaux sont peut-être encore utilisés"
    else
      echo "Aucun réseau à supprimer pour le projet : $PROJECT_NAME"
    fi

    if [[ "${EXTRA_ARGS[0]:-}" == "--volumes" ]]; then
      PROJECT_VOLUMES=$(docker volume ls --filter "label=com.docker.compose.project=$PROJECT_NAME" -q)
      if [[ -n "$PROJECT_VOLUMES" ]]; then
        VOLUME_NAMES=$(docker volume ls --filter "label=com.docker.compose.project=$PROJECT_NAME" --format '{{.Name}}' | tr '\n' ', ' | sed 's/,$//')
        echo "Suppression des volumes : $VOLUME_NAMES"
        # shellcheck disable=SC2086
        docker volume rm $PROJECT_VOLUMES
      else
        echo "Aucun volume à supprimer pour le projet : $PROJECT_NAME"
      fi
    fi

    echo "Nettoyage terminé pour $ENVIRONMENT. Conteneurs et réseaux supprimés."
    echo "Astuce : './deploy.sh $ENVIRONMENT kill --volumes' supprime aussi les volumes (données PocketBase incluses !)."
    ;;

  *)
    echo "Erreur : action inconnue '$ACTION'"
    echo "Actions valides : up, down, logs, ps, pull, restart, config, validate, kill"
    exit 1
    ;;
esac
