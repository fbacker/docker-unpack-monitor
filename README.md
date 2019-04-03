# docker-unpack-monitor

A docker container that listen recusivly on a watch folder. Scans for \*.rar files and unpacks. Will also do a full scan at startup.

If a failed unpack occurs, e.g. not all rxx files are in place. It will retry to unpack later, but a maximum of 3 retries.

Note: If issue with permissions, make sure to set PGID/UID to unpack with correct user access (not root).

## How it works

1. On Starup, it will scan all files and folders recursivly
2. Add a file watch on the directory, if anything changes scan all files and folders recursivly on changed location.
3. When finding a .rar file
   - check if a .{filename}, if exists ignore
   - place it in que
4. Unpack the que one at the time
5. If unpack is successfull, place a .{filename} empty file at location, to skip reunpack

### Retrigger an unpack

When unpacked it will place a "hidden" file. This to check if a file is already unpacked and should be ignored.

To restart an unpack, make sure the "dot" .{filename-of-rar-file} file is removed. Then rename folder or restart container.

## Run container

```docker
  docker run \
    --name=unpack \
    --volume=/path-to-monitor-folder:/watch
    fbacker/docker-unpack-monitor
```

## Run with composer

```docker
unpack:
  image: fredrickbacker/unpack-monitor:latest
  container_name: unpack
  volumes:
    - /path-to-monitor-folder:/watch
  restart: always
  environment:
    - PGID=1000
    - PUID=1000
```

## Environment variables

```js
// Ignore for checking the .{filename}, always unpack
ALWAYS_UNPACK = true | false;
```
