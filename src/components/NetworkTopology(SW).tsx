import React, { useEffect, useRef } from 'react';
import { DataSet, Network } from 'vis-network/standalone';

type SwitchLinkConfig = {
  selectedHost1: string;
  selectedHost2: string;
  selectedInterface1: string;
  selectedInterface2: string;
  switchportMode: string;
  vlans: string[];
};

type Interface = {
  interface: string;
  ip_address: string;
  status: string;
};

type InterfaceData = {
  hostname: string;
  interfaces: Interface[];
};

type SwitchNetworkTopologyProps = {
  links: SwitchLinkConfig[];
  interfaceData: InterfaceData[];
};

const SwitchNetworkTopology: React.FC<SwitchNetworkTopologyProps> = ({ links, interfaceData }) => {
  const networkContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (networkContainer.current) {
      // Build a unique set of nodes from the switch host names.
      const nodeSet = new Set<string>();
      links.forEach(link => {
        nodeSet.add(link.selectedHost1);
        nodeSet.add(link.selectedHost2);
      });

      // Build nodes – here using a switch icon.
      const nodes = Array.from(nodeSet).map(hostname => ({
        id: hostname,
        label: hostname,
        shape: 'image',
        image: '/Switch.png', // Ensure you have your switch icon at this path.
        size: 25,
      }));

      // Build edges. For each link, look up the corresponding interface data to display IP addresses.
      const edges = links.map((link, index) => {
        const host1Data = interfaceData.find(item => item.hostname === link.selectedHost1);
        const host2Data = interfaceData.find(item => item.hostname === link.selectedHost2);
        const ip1 = host1Data
          ? host1Data.interfaces.find(intf => intf.interface === link.selectedInterface1)?.ip_address || 'N/A'
          : 'N/A';
        const ip2 = host2Data
          ? host2Data.interfaces.find(intf => intf.interface === link.selectedInterface2)?.ip_address || 'N/A'
          : 'N/A';

        return {
          id: index,
          from: link.selectedHost1,
          to: link.selectedHost2,
          title: `${link.selectedHost1}<${link.selectedInterface1}> ⇄ ${link.selectedHost2}<${link.selectedInterface2}>
Switchport Mode: ${link.switchportMode}
VLANs: ${link.vlans.join(', ') || 'None'}`,
        };
      });

      const data = {
        nodes: new DataSet(nodes),
        edges: new DataSet(edges),
      };

      const options = {
        layout: {
          hierarchical: false,
        },
        physics: {
          stabilization: {
            enabled: true,
            iterations: 100,
            updateInterval: 25,
          },
          enabled: false,
        },
      };

      const network = new Network(networkContainer.current, data, options);

      return () => {
        network.destroy();
      };
    }
  }, [links, interfaceData]);

  return (
    <div
      ref={networkContainer}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
};

export default SwitchNetworkTopology;
