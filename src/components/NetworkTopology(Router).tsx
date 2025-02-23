import React, { useEffect, useRef } from 'react';
import { DataSet, Network } from 'vis-network/standalone';

type LinkConfig = {
  hostname1: string;
  hostname2: string;
  interface1: string;
  interface2: string;
  ip1: string;
  ip2: string;
  subnet: string;
  protocol: string;
};

type NetworkTopologyProps = {
  links: LinkConfig[];
};

// --- Helper functions to compute network CIDR from an IP and a CIDR prefix ---
function ipToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

function calculateNetwork(ip: string, cidr: number): string {
  const ipInt = ipToInt(ip);
  // Create the netmask as a 32-bit number:
  const mask = ~(Math.pow(2, 32 - cidr) - 1) >>> 0;
  const networkInt = ipInt & mask;
  return intToIp(networkInt) + '/' + cidr;
}

const NetworkTopology: React.FC<NetworkTopologyProps> = ({ links }) => {
  const networkContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (networkContainer.current) {
      // Build a unique set of nodes from the hostnames in the links.
      const nodeSet = new Set<string>();
      links.forEach(link => {
        nodeSet.add(link.hostname1);
        nodeSet.add(link.hostname2);
      });
      
      // Use a router icon for each node by setting shape to 'image'
      const nodes = Array.from(nodeSet).map((hostname) => ({
        id: hostname,
        label: hostname,
        shape: 'image',
        image: '/Router.png',  // Make sure your router icon is at this path
        size: 25,
      }));
      
      // Build edges from the links.
      const edges = links.map((link, index) => {
        const cidr = parseInt(link.subnet, 10);
        // Calculate the network address from ip1 and subnet.
        const networkCIDR = calculateNetwork(link.ip1, cidr);
        return {
          id: index,
          from: link.hostname1,
          to: link.hostname2,
          // Use the computed network CIDR and activated protocol as the edge title.
          title: `${link.hostname1} [${link.interface1} (${link.ip1})] ⇄ ${link.hostname2} [${link.interface2} (${link.ip2})]
Network: ${networkCIDR}
Activated Protocol: ${link.protocol}`,
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

      // Cleanup on unmount
      return () => {
        network.destroy();
      };
    }
  }, [links]);

  return (
    <div
      ref={networkContainer}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
};

export default NetworkTopology;
