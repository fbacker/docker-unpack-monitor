docker-unpack-monitor
=====================

A container that listen to changes recursivly in a folder.
When a *.rar file is added it will unpack it with a delay
to make sure all extra *.rxx files are there.

Usage
-----

    docker run \
      --name=unpack \
      --volume=/path-to-monitor-folder:/watch
      fbacker/docker-unpack-monitor

Roadmap
-------

- [ ] "fixed" variable values isn't kept after initial run in monitor.sh
- [ ] change unrar to maybe unp or better?
- [ ] allow change of delay until unpack
- [ ] allow change of filetypes to unpack