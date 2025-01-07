import React from 'react';
import { Table, Button } from 'antd';

interface Host {
  id: string;
  deviceType: string;
  hostname: string;
  ipAddress: string;
  username: string;
}

interface HostsTableProps {
  filteredHosts: Host[];
  searchQuery: string;
  handleDeleteHost: (hostname: string) => void;
}

const HostsTable: React.FC<HostsTableProps> = ({
  filteredHosts,
  searchQuery,
  handleDeleteHost,
}) => {
  // Define columns for Ant Design table
  const columns = [
    {
      title: 'Device Type',
      dataIndex: 'deviceType',
      key: 'deviceType',
    },
    {
      title: 'Hostname',
      dataIndex: 'hostname',
      key: 'hostname',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Host) => (
        <Button
          type="link"
          onClick={() => handleDeleteHost(record.hostname)}
        >
          Delete
        </Button>
      ),
    },
  ];

  // When no hosts are found, display custom row
  const emptyText = `No results found for "${searchQuery}".`;

  return (
    <Table
      dataSource={filteredHosts}
      columns={columns}
      rowKey="id"
      locale={{
        emptyText,
      }}
    />
  );
};

export default HostsTable;
