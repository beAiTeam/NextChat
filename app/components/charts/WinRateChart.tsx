import { Button, Card, Spin } from "antd";
import ReactECharts from 'echarts-for-react';

interface WinRateChartProps {
  chartData: any[];
  loading: boolean;
  winType: "current" | "two" | "any";
  onLoadMore?: () => void;
}

const WinRateChart = ({ chartData, loading, winType, onLoadMore }: WinRateChartProps) => {
  const winRateOption = {
    title: {
      text: '胜率趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: '{b}<br/>胜率: {c}%'
    },
    xAxis: {
      type: 'category' as const,
      data: chartData.map(item => item.time),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(chartData.length / 10)
      }
    },
    yAxis: {
      type: 'value' as const,
      min: winType === "any" ? 50 : winType === "two" ? 40 : 0,
      max: 100,
      name: '胜率(%)',
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed' as const
        }
      }
    },
    series: [{
      data: chartData.map(item => item.winRate),
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: '#2593fc'
      },
      lineStyle: {
        width: 2
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          {
            yAxis: 70,
            lineStyle: {
              color: '#ff4d4f',
              width: 2,
              type: 'solid' as const
            }
          }
        ]
      }
    }]
  };

  return (
    <Card>
      <Spin spinning={loading}>
        <div style={{ position: 'relative' }}>
          <ReactECharts
            option={winRateOption}
            style={{ height: '400px' }}
            notMerge={true}
            opts={{ renderer: 'svg' }}
          />
          {onLoadMore && (
            <Button 
              type="primary" 
              onClick={onLoadMore}
              style={{ 
                position: 'absolute', 
                left: '20px', 
                bottom: '20px',
                zIndex: 1
              }}
            >
              加载更多数据
            </Button>
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default WinRateChart; 