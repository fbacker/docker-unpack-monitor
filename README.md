# docker-unpack-monitor

A container that listen to changes recursivly in a folder.
When a _.rar file is added it will unpack it with a delay
to make sure all extra _.rxx files are there.

It will also trigger a full recursive scan to unpack all files at startup.

Note: If issue with permissions, make sure to set PGID/UID.

### Retrigger an unpack

When unpacked it will place a "hidden" file. This to check
if a file is already unpacked and should be ignored.

To restart an unpack, make sure the "dot" file is removed and e.g. rename folder or restart docker container

myfile.rar, when unpacked a .myfile will be placed in same folder.

## Usage

    docker run \
      --name=unpack \
      --volume=/path-to-monitor-folder:/watch
      fbacker/docker-unpack-monitor

## Usage compose

unpack:
image: fredrickbacker/unpack-monitor:latest
container_name: unpack
volumes: - /path-to-monitor-folder:/watch
restart: always
environment: - PGID=1000 - PUID=1000
