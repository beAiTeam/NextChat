import { Card, Spin } from "antd";
import ReactECharts from 'echarts-for-react';

interface HeatmapChartProps {
  heatmapData: any[];
  loading: boolean;
}

const HeatmapChart = ({ heatmapData, loading }: HeatmapChartProps) => {
  const heatmapOption = {
    title: {
      text: '开奖状态热力图',
      left: 'center'
    },
    tooltip: {
      position: 'top' as const,
      formatter: function (params: any) {
        return `时间: ${params.data[0]}时 第${params.data[1] + 1}期<br/>状态: ${params.data[2] ? '中奖' : '未中奖'}`;
      }
    },
    grid: {
      top: '60px',
      bottom: '10%',
      left: '10%',
      right: '10%'
    },
    xAxis: {
      type: 'category' as const,
      data: Array.from({ length: 24 }, (_, i) => `${i}时`),
      splitArea: {
        show: true
      }
    },
    yAxis: {
      type: 'category' as const,
      data: Array.from({ length: 12 }, (_, i) => `${i + 1}期`),
      splitArea: {
        show: true
      }
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: false,
      orient: 'horizontal' as const,
      left: 'center',
      bottom: '0%',
      inRange: {
        color: ['#dcdcdc', '#52c41a']
      },
      textStyle: {
        color: '#333'
      }
    },
    series: [{
      name: '开奖状态',
      type: 'heatmap' as const,
      data: heatmapData,
      label: {
        show: false
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  };

  return (
    <Card>
      <Spin spinning={loading}>
        <ReactECharts
          option={heatmapOption}
          style={{ height: '400px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Spin>
    </Card>
  );
};

export default HeatmapChart; 