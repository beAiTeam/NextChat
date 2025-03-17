import { DatePicker, Radio, Select, Space, Spin } from "antd";
import { Dayjs } from "dayjs";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import axiosServices from "../utils/my-axios";
import {
  checkCurrentPeriodMatch,
  checkThreePeriodsMatch,
  checkTwoPeriodsMatch,
  DrawResult,
  formatGuessResult,
  GuessResult,
} from "../utils/predict-utils";

const { RangePicker } = DatePicker;

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
  onTimeRangeChange?: (timeRange: [Dayjs | null, Dayjs | null]) => void;
  defaultPageSize?: number;
  defaultWinType?: "current" | "two" | "any";
}

export interface PredictStatsRef {
  refresh: () => void;
  getTimeRange: () => [Dayjs | null, Dayjs | null];
}

const PredictStats = forwardRef<PredictStatsRef, PredictStatsProps>(
  (
    {
      guess_type,
      onDataChange,
      onWinTypeChange,
      onTimeRangeChange,
      defaultPageSize = 100,
      defaultWinType = "current",
    },
    ref,
  ) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PredictItem[]>([]);
    const [pageSize, setPageSize] = useState(defaultPageSize);
    const [winType, setWinType] = useState<"current" | "two" | "any">(
      defaultWinType,
    );
    const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

    // 检查当期是否中奖
    const checkCurrentPeriodWin = (record: PredictItem): boolean => {
      if (!record.guess_result || !record.ext_result) {
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
      if (!record.guess_result || !record.ext_result) {
        return false;
      }

      const prediction = formatGuessResult(record.guess_result);
      return checkTwoPeriodsMatch(prediction, record.ext_result);
    };

    // 检查三期内是否中奖
    const checkThreePeriodsWin = (record: PredictItem): boolean => {
      if (!record.guess_result || !record.ext_result) {
        return false;
      }

      const prediction = formatGuessResult(record.guess_result);
      return checkThreePeriodsMatch(prediction, record.ext_result);
    };

    // 计算胜率
    const calculateWinRate = (items: PredictItem[]): number => {
      // 根据不同的winType筛选有效数据
      const validItems = items.filter((item) => {
        if (!item.ext_result || !item.guess_result) return false;
        
        if (winType === "current") {
          return item.ext_result.length > 0;
        } else if (winType === "two") {
          return item.ext_result.length >= 2;
        } else { // winType === "any" (三期)
          return item.ext_result.length >= 3;
        }
      });
      
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
        const params: any = {
          page: 1,
          page_size: size,
          guess_type: guess_type,
        };

        // 添加时间范围参数
        if (timeRange[0] && timeRange[1]) {
          params.start_time = Math.floor(timeRange[0].valueOf()/1000);
          params.end_time = Math.floor(timeRange[1].valueOf()/1000);
        }

        const response = await axiosServices.get(
          "/client/lot/get_ai_guess_list",
          {
            params,
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

    useImperativeHandle(ref, () => ({
      refresh: () => fetchData(pageSize),
      getTimeRange: () => timeRange,
    }));

    useEffect(() => {
      fetchData(pageSize);
    }, [pageSize, timeRange]);

    // 监听guess_type变化，重新获取数据
    useEffect(() => {
      fetchData(pageSize);
    }, [guess_type]);

    const handleWinTypeChange = (e: any) => {
      const newWinType = e.target.value;
      setWinType(newWinType);
      onWinTypeChange?.(newWinType);
    };

    // 处理时间范围变化
    const handleTimeRangeChange = (dates: any) => {
      if (dates) {
        setTimeRange([dates[0], dates[1]]);
        onTimeRangeChange?.([dates[0], dates[1]]);
      } else {
        setTimeRange([null, null]);
        onTimeRangeChange?.([null, null]);
      }
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
              { value: 2000, label: "2000条" },
              { value: 5000, label: "5000条" },
            ]}
          />
          
          <Radio.Group value={winType} onChange={handleWinTypeChange}>
            <Radio.Button value="current">当期胜率</Radio.Button>
            <Radio.Button value="two">两期胜率</Radio.Button>
            <Radio.Button value="any">三期胜率</Radio.Button>
          </Radio.Group>

          <RangePicker
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            onChange={handleTimeRangeChange}
            style={{ minWidth: '300px' }}
          />
          
          <span>
            {pageSize}条胜率：
            {loading ? (
              <Spin size="small" />
            ) : (
              `${calculateWinRate(data).toFixed(2)}%（有效数据：${data.filter(item => {
                if (!item.ext_result || !item.guess_result) return false;
                if (winType === "current") return item.ext_result.length > 0;
                if (winType === "two") return item.ext_result.length >= 2;
                return item.ext_result.length >= 3;
              }).length}条）`
            )}
          </span>
        </Space>
      </div>
    );
  },
);

PredictStats.displayName = 'PredictStats';

export default PredictStats;
