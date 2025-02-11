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
  // You can add any additional properties if needed.
};

type NetworkTopologyProps = {
  links: LinkConfig[];
};

const NetworkTopology: React.FC<NetworkTopologyProps> = ({ links }) => {
  const networkContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (networkContainer.current) {
      try {
        // Build a unique set of nodes
        const nodeSet = new Set<string>();
        links.forEach(link => {
          nodeSet.add(link.hostname1);
          nodeSet.add(link.hostname2);
        });
        const nodes = Array.from(nodeSet).map((hostname) => ({
          id: hostname,
          label: hostname,
        }));
  
        // Build edges: Each link creates an edge between hostname1 and hostname2.
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
            stabilization: false,
          },
        };
  
        const network = new Network(networkContainer.current, data, options);
        // Cleanup on unmount
        return () => {
          network.destroy();
        };
      } catch (err) {
        console.error('Error initializing network:', err);
      }
    }
  }, [links]);
  
  
  return <div ref={networkContainer} style={{ height: '400px', border: '1px solid lightgray' }} />;
};

export default NetworkTopology;
