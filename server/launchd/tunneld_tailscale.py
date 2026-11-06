"""tunneld + hosts RemotePairing fixos (ex.: IP do iPhone no Tailscale).

O Bonjour só enxerga a LAN. Fora dela, injeta o iPhone como se o Bonjour o tivesse achado.
Env: TUNNELD_EXTRA_HOSTS="100.65.175.42:49152,..."  TUNNELD_SKIP_BONJOUR=1 (teste: só os fixos)
"""
import os
import sys

from pymobiledevice3.bonjour import Address, ServiceInstance
from pymobiledevice3.remote import tunnel_service
from pymobiledevice3.__main__ import main

EXTRA = [h.split(":") for h in os.environ.get("TUNNELD_EXTRA_HOSTS", "").split(",") if h]
_browse = tunnel_service.browse_remotepairing


async def browse(timeout=None):
    found = [] if os.environ.get("TUNNELD_SKIP_BONJOUR") else await _browse(timeout) if timeout else await _browse()
    for ip, port in EXTRA:
        found.append(ServiceInstance(instance=f"static-{ip}", host=ip, port=int(port), addresses=[Address(ip=ip, iface="")]))
    return found


tunnel_service.browse_remotepairing = browse

if __name__ == "__main__":
    sys.argv[0] = "pymobiledevice3"
    sys.exit(main())
