"use client";

import { Line } from "@ant-design/plots";
import { Card, Radio, Select, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import {
  checkCurrentPeriodMatch,
  checkThreePeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult,
} from "../utils/predict-utils";
import MainLayout from "./Layout";
import "./PredictChart.scss";

interface PredictItem {
  _id: string;
  created_at: string;
  updated_at: string;
  guess_period: string;
  guess_time: number;
  guess_result: GuessResult | null;
  guess_type: "ai_5_normal";
  ext_result: DrawResult[] | null;
  draw_status: "created" | "drawed" | "executing" | "finished" | "failed";
  retry_count: number;
  is_success: boolean;
}

const PredictChart = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [winType, setWinType] = useState<"current" | "any">("current");
  const [chartData, setChartData] = useState<any[]>([]);

  // 检查当期是否中奖
  const checkCurrentPeriodWin = (record: PredictItem): boolean => {
    if (
      !record.guess_result ||
      !record.ext_result ||
      record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkCurrentPeriodMatch(
      prediction,
      record.ext_result,
      record.guess_period,
    );
  };

  // 检查三期内是否中奖
  const checkThreePeriodsWin = (record: PredictItem): boolean => {
    if (
      !record.guess_result ||
      !record.ext_result ||
      record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkThreePeriodsMatch(prediction, record.ext_result);
  };

  // 计算胜率
  const calculateWinRate = (items: PredictItem[]): number => {
    const validItems = items.filter(
      (item) => item.ext_result && item.ext_result.length > 0,
    );
    if (validItems.length === 0) return 0;

    const winCount = validItems.filter((item) =>
      winType === "current"
        ? checkCurrentPeriodWin(item)
        : checkThreePeriodsWin(item),
    ).length;

    return (winCount / validItems.length) * 100;
  };

  // 处理数据并生成图表数据
  const processChartData = (items: PredictItem[]) => {
    // 按时间排序
    const sortedItems = [...items].sort((a, b) => a.guess_time - b.guess_time);

    // 生成图表数据
    const chartData = sortedItems.map((item, index) => {
      // 计算到当前项为止的所有数据的胜率
      const currentItems = sortedItems.slice(0, index + 1);
      const winRate = calculateWinRate(currentItems);

      const date = new Date(item.guess_time * 1000);
      const today = new Date();
      let timeStr;

      if (date.toDateString() === today.toDateString()) {
        timeStr = date.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      } else {
        timeStr = date.toLocaleString("zh-CN");
      }

      return {
        time: timeStr,
        winRate: Number(winRate.toFixed(2)),
      };
    });

    setChartData(chartData);
  };

  const fetchData = async (size: number) => {
    setLoading(true);
    try {
      const response = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params: {
            page: 1,
            page_size: size,
            guess_type: "ai_5_normal",
          },
        },
      );
      setData(response.data.data.data);
      processChartData(response.data.data.data);
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pageSize);
  }, [pageSize]);

  useEffect(() => {
    processChartData(data);
  }, [winType]);

  const config = {
    data: chartData,
    xField: "time",
    yField: "winRate",
    padding: "auto",
    smooth: true,
    forceFit: true,
    xAxis: {
      type: "category",
      title: {
        text: "预测时间",
      },
    },
    yAxis: {
      title: {
        text: "胜率(%)",
      },
      min: 0,
      max: 100,
    },
    point: {
      visible: true,
      size: 5,
      shape: "diamond",
      style: {
        fill: "white",
        stroke: "#2593fc",
        lineWidth: 2,
      },
    },
  };

  return (
    <MainLayout>
      <div className="predict-chart-container">
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Card>
            <Space>
              <span>数据量：</span>
              <Select
                value={pageSize}
                onChange={setPageSize}
                options={[
                  { value: 10, label: "10条" },
                  { value: 50, label: "50条" },
                  { value: 100, label: "100条" },
                  { value: 200, label: "200条" },
                  { value: 500, label: "500条" },
                  { value: 1000, label: "1000条" },
                ]}
              />
              <span>胜率类型：</span>
              <Radio.Group
                value={winType}
                onChange={(e) => setWinType(e.target.value)}
              >
                <Radio.Button value="current">当期胜率</Radio.Button>
                <Radio.Button value="any">三期胜率</Radio.Button>
              </Radio.Group>
              <span>
                当前总胜率：
                {loading ? (
                  <Spin size="small" />
                ) : (
                  `${calculateWinRate(data).toFixed(2)}%`
                )}
              </span>
            </Space>
          </Card>

          <Card>
            <Spin spinning={loading}>
              <Line {...config} />
            </Spin>
          </Card>
        </Space>
      </div>
    </MainLayout>
  );
};

export default PredictChart;
