import { Card, Spin } from "antd";
import ReactECharts from 'echarts-for-react';

interface WeeklyChartProps {
  weeklyChartData: any[];
  loading: boolean;
  winType: "current" | "two" | "any";
}

const WeeklyChart = ({ weeklyChartData, loading, winType }: WeeklyChartProps) => {
  const weeklyOption = {
    title: {
      text: '最近一周每日胜率',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis' as const,
      formatter: function(params: any) {
        let result = params[0].name + '<br/>';
        params.forEach((param: any) => {
          const data = param.data;
          const color = param.color;
          const marker = `<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
          if (param.seriesIndex === 0) {
            result += `${marker}全天: ${data}%（样本: ${param.data.count}）<br/>`;
          } else if (param.seriesIndex === 1) {
            result += `${marker}白天: ${data}%（样本: ${param.data.count}）<br/>`;
          } else if (param.seriesIndex === 2) {
            result += `${marker}晚上: ${data}%（样本: ${param.data.count}）<br/>`;
          }
        });
        return result;
      }
    },
    legend: {
      data: ['全天', '白天', '晚上'],
      top: '30px'
    },
    grid: {
      top: '80px',
      bottom: '10%',
      left: '10%',
      right: '10%'
    },
    xAxis: {
      type: 'category' as const,
      data: weeklyChartData.map(item => item.date),
      axisLabel: {
        rotate: 0
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
    series: [
      {
        name: '全天',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.allDay.winRate,
          count: item.allDay.count
        })),
        itemStyle: {
          color: '#2593fc'
        },
        label: {
          show: true,
          position: 'top' as const,
          formatter: '{c}%'
        }
      },
      {
        name: '白天',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.dayTime.winRate,
          count: item.dayTime.count
        })),
        itemStyle: {
          color: '#52c41a'
        },
        label: {
          show: true,
          position: 'top' as const,
          formatter: '{c}%'
        }
      },
      {
        name: '晚上',
        type: 'bar' as const,
        data: weeklyChartData.map(item => ({
          value: item.nightTime.winRate,
          count: item.nightTime.count
        })),
        itemStyle: {
          color: '#ff4d4f'
        },
        label: {
          show: true,
          position: 'top' as const,
          formatter: '{c}%'
        }
      }
    ]
  };

  return (
    <Card title="最近一周每日胜率">
      <Spin spinning={loading}>
        <ReactECharts
          option={weeklyOption}
          style={{ height: '400px' }}
          notMerge={true}
          opts={{ renderer: 'svg' }}
        />
      </Spin>
    </Card>
  );
};

export default WeeklyChart;
