import { Card, Spin } from "antd";
import ReactECharts from 'echarts-for-react';

interface BalanceChartProps {
  balanceData: any[];
  loading: boolean;
  onViewDetails: () => void;
}

const BalanceChart = ({ balanceData, loading, onViewDetails }: BalanceChartProps) => {
  const balanceOption = {
    title: {
      text: '余额变化趋势',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: function(params: any) {
        // 余额数值保留 2 位小数
        return `${params[0].name}<br/>余额: ${params[0].value.toFixed(2)}`;
      }
    },
    toolbox: {
      feature: {
        myTool: {
          show: true,
          title: '查看详情',
          icon: 'path://M432.45,595.444c0,2.177-4.661,6.82-11.305,6.82c-6.475,0-11.306-4.567-11.306-6.82s4.852-6.812,11.306-6.812C427.841,588.632,432.452,593.191,432.45,595.444L432.45,595.444z M421.155,589.876c-3.009,0-5.448,2.495-5.448,5.572s2.439,5.572,5.448,5.572c3.01,0,5.449-2.495,5.449-5.572C426.604,592.371,424.165,589.876,421.155,589.876L421.155,589.876z M421.146,591.891c-1.916,0-3.47,1.589-3.47,3.549c0,1.959,1.554,3.548,3.47,3.548s3.469-1.589,3.469-3.548C424.614,593.479,423.062,591.891,421.146,591.891L421.146,591.891zM421.146,591.891',
          onclick: onViewDetails
        }
      }
    },
    xAxis: {
      type: 'category' as const,
      data: balanceData.map(item => item.time),
      axisLabel: {
        rotate: 45,
        interval: Math.floor(balanceData.length / 10)
      }
    },
    yAxis: {
      type: 'value' as const,
      name: '余额',
      splitLine: {
        show: true,
        lineStyle: {
          type: 'dashed' as const
        }
      }
    },
    series: [{
      data: balanceData.map(item => item.balance),
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
            yAxis: 0,
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
        <ReactECharts
          option={balanceOption}
          style={{ height: '400px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Spin>
    </Card>
  );
};

export default BalanceChart; 