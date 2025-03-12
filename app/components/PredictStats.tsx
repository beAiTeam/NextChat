import { Radio, Select, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import axiosServices from "../utils/my-axios";
import {
  checkCurrentPeriodMatch,
  checkThreePeriodsMatch,
  checkTwoPeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult,
} from "../utils/predict-utils";

interface PredictItem {
  _id: string;
  created_at: string;
  updated_at: string;
  guess_period: string;
  guess_time: number;
  guess_result: GuessResult | null;
  guess_type: string;
  ext_result: DrawResult[] | null;
  draw_status: "created" | "drawed" | "executing" | "finished" | "failed";
  retry_count: number;
  is_success: boolean;
}

interface PredictStatsProps {
  guess_type: string;
  onDataChange?: (data: PredictItem[]) => void;
  onWinTypeChange?: (winType: "current" | "two" | "any") => void;
  defaultPageSize?: number;
  defaultWinType?: "current" | "two" | "any";
}

const PredictStats = ({ 
  guess_type,
  onDataChange, 
  onWinTypeChange,
  defaultPageSize = 100,
  defaultWinType = "current"
}: PredictStatsProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictItem[]>([]);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [winType, setWinType] = useState<"current" | "two" | "any">(defaultWinType);

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

  // 检查两期内是否中奖
  const checkTwoPeriodsWin = (record: PredictItem): boolean => {
    if (
      !record.guess_result ||
      !record.ext_result ||
      record.ext_result.length === 0
    ) {
      return false;
    }

    const prediction = formatGuessResult(record.guess_result);
    return checkTwoPeriodsMatch(prediction, record.ext_result);
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

    const winCount = validItems.filter((item) => {
      if (winType === "current") return checkCurrentPeriodWin(item);
      if (winType === "two") return checkTwoPeriodsWin(item);
      return checkThreePeriodsWin(item);
    }).length;

    return (winCount / validItems.length) * 100;
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
            guess_type: guess_type,
          },
        },
      );
      const newData = response.data.data.data;
      setData(newData);
      onDataChange?.(newData);
    } catch (error) {
      console.error("获取数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(pageSize);
  }, [pageSize]);

  const handleWinTypeChange = (e: any) => {
    const newWinType = e.target.value;
    setWinType(newWinType);
    onWinTypeChange?.(newWinType);
  };

  return (
    <div>
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
          onChange={handleWinTypeChange}
        >
          <Radio.Button value="current">当期胜率</Radio.Button>
          <Radio.Button value="two">两期胜率</Radio.Button>
          <Radio.Button value="any">三期胜率</Radio.Button>
        </Radio.Group>
        <span>
          {pageSize}条数据总胜率：
          {loading ? (
            <Spin size="small" />
          ) : (
            `${calculateWinRate(data).toFixed(2)}%`
          )}
        </span>
      </Space>
    </div>
  );
};

export default PredictStats; 