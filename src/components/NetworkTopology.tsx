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
        shape: 'image',                 // Use an image instead of a default shape
        image: '/Router.png',      // Path to your router icon (adjust as needed)
        size: 30,                       // Optional: adjust size as needed
      }));

      // Build edges from the links.
      const edges = links.map((link, index) => ({
        id: index,
        from: link.hostname1,
        to: link.hostname2,
      }));

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
        // border: '1px solid lightgray',
        overflow: 'hidden',
      }}
    />
  );
};

export default NetworkTopology;
