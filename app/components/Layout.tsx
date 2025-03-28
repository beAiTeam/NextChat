import {
  AppstoreOutlined,
  FileSearchOutlined,
  FireOutlined,
  LineChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined, MergeOutlined,
  MessageOutlined, PrinterOutlined,
  RobotOutlined,
  RocketOutlined,
  SettingOutlined,
  ToolOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Layout.module.css';

const { Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'webos', 'mobile'];
      setIsMobile(mobileKeywords.some(keyword => userAgent.includes(keyword)));
    };
    
    checkMobile();
  }, []);

  const menuItems = [
    {
      key: '/todo',
      icon: <FileSearchOutlined />,
      label: 'List',
    },
    {
      key: '/chicken-analysis',
      icon: <TrophyOutlined />,
      label: '吃鸡分析',
    },
    {
      key: '/predict-mix',
      icon: <MergeOutlined />,
      label: 'AI混合预测',
    },
    {
      key: '/predict',
      icon: <FireOutlined />,
      label: 'AI预测',
    },
    {
      key: '/predict-plus',
      icon: <RocketOutlined />,
      label: 'AI预测Plus',
    },
    {
      key: '/predict-gemini',
      icon: <RocketOutlined />,
      label: 'AI预测 Gemini',
    },
    {
      key: '/predict-gemini-plus',
      icon: <RocketOutlined />,
      label: 'AI预测 Gemini Plus',
    },
    {
      key: "/predict-gemini-pro",
      icon: <RocketOutlined />,
      label: "AI预测 Gemini Pro",
    },
    {
      key: '/predict-chart',
      icon: <LineChartOutlined />,
      label: 'AI预测图表',
    },
    {
      key: '/predict-compare',
      icon: <LineChartOutlined />,
      label: '多模型对比',
    },
    {
      key: '/aitype',
      icon: <AppstoreOutlined />,
      label: 'AI类型',
    },
    {
      key: '/log',
      icon: <PrinterOutlined />,
      label: 'Log',
    },
    {
      key: '/prompt',
      icon: <RobotOutlined />,
      label: 'Prompt管理',
    },
    {
      key: '/tool',
      icon: <ToolOutlined />,
      label: '工具箱',
    },
    {
      key: '/predict-config',
      icon: <SettingOutlined />,
      label: '预测配置',
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
        className={isMobile ? styles.mobileSider : styles.mainSider}
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        trigger={null}
      >
        <div className={isMobile ? styles.mobileHeader : styles.mainHeader} style={{
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
        <Content 
          className={isMobile ? styles.mobileContent : styles.mainContent} 
          style={{ 
            padding: '24px', 
            background: '#fff',   
            overflowY: 'auto', 
            height: 'calc(100vh - 48px)'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
