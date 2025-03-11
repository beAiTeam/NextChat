import { AppstoreOutlined, LineChartOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined, RobotOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const { Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  const menuItems = [
    {
      key: '/todo',
      icon: <UnorderedListOutlined />,
      label: 'List',
    },
    {
      key: '/predict',
      icon: <LineChartOutlined />,
      label: 'AI预测',
    },
    {
      key: '/predict-chart',
      icon: <LineChartOutlined />,
      label: 'AI预测图表',
    },
    {
      key: '/aitype',
      icon: <AppstoreOutlined />,
      label: 'AI类型',
    },
    {
      key: '/prompt',
      icon: <RobotOutlined />,
      label: 'Prompt管理',
    },
    {
      key: '/',
      icon: <MessageOutlined />,
      label: 'Chat',
    },
  ];

  const handleMenuClick = (key: string) => {
    router.push(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        trigger={null}
      >
        <div style={{
          height: '64px',
          display: 'flex',
          marginLeft: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px'
        }}>

          {collapsed ? (
            <MenuUnfoldOutlined
              style={{ fontSize: '16px', cursor: 'pointer' }}
              onClick={() => setCollapsed(false)}
            />
          ) : (
            <MenuFoldOutlined
              style={{ fontSize: '16px', cursor: 'pointer' }}
              onClick={() => setCollapsed(true)}
            />
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onSelect={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <Layout>
        <Content style={{ padding: '24px', background: '#fff', margin: '24px 16px', overflowY: 'auto', height: 'calc(100vh - 48px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
