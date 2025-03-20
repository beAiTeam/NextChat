import { Card, Spin } from "antd";
import ReactECharts from 'echarts-for-react';

interface WinLoseChartProps {
  winLoseData: any[];
  loading: boolean;
}

const WinLoseChart = ({ winLoseData, loading }: WinLoseChartProps) => {
  const winLoseOption = {
    title: {
      text: '中奖状态',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: function(params: any) {
        const value = params[0].value;
        return `${params[0].name}<br/>${value > 0 ? '中奖' : '未中奖'}`;
      }
    },
    xAxis: {
      type: 'category' as const,
      data: winLoseData.map(item => item.time),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(winLoseData.length / 10)
      }
    },
    yAxis: {
      type: 'value' as const,
      min: -2,
      max: 2,
      interval: 1,
      axisLabel: {
        formatter: function(value: number) {
          if (value === 1) return '中奖';
          if (value === -1) return '未中奖';
          return '';
        }
      }
    },
    series: [{
      data: winLoseData.map(item => item.value),
      type: 'line' as const,
      step: 'middle' as const,
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: {
        color: function(params: any) {
          return params.data > 0 ? '#52c41a' : '#ff4d4f';
        }
      },
      lineStyle: {
        width: 2
      }
    }],
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%'
    }
  };

  return (
    <Card>
      <Spin spinning={loading}>
        <ReactECharts
          option={winLoseOption}
          style={{ height: '400px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Spin>
    </Card>
  );
};

export default WinLoseChart; 