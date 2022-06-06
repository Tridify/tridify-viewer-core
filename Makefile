install:
	docker-compose -f docker-compose.yml run --rm install
build:
	docker-compose -f docker-compose.yml run --rm build
link:
	docker-compose -f docker-compose.yml run --rm link
setup:
	docker volume create nodemodules_viewer-core
clear:
	docker-compose rm --force
	docker volume rm --force nodemodules_viewer-core
version:
	docker-compose -f docker-compose.yml run --rm version