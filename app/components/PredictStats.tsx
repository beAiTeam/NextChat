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
  isCompare?: boolean;
  baseGuessType?: string;
  compareGuessType?: string;
  switchStrategy?: number;
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
      isCompare,
      compareGuessType,
      baseGuessType,
      switchStrategy,
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
    const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null]>([
      null,
      null,
    ]);

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
        } else {
          // winType === "any" (三期)
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
          params.start_time = Math.floor(timeRange[0].valueOf() / 1000);
          params.end_time = Math.floor(timeRange[1].valueOf() / 1000);
        }

        let newData;
        if (isCompare) {
          newData = await fetchCompareData(params);
        } else {
          const response = await axiosServices.get(
            "/client/lot/get_ai_guess_list",
            {
              params,
            },
          );
          newData = response.data.data.data;
        }

        console.log("newData", newData);

        setData(newData);
        onDataChange?.(newData);
      } catch (error) {
        console.error("获取数据失败:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCompareData = async (params: any) => {
      // 获取默认模型数据
      const defaultResponse = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params: {
            ...params,
            guess_type: baseGuessType,
          },
        },
      );

      // 获取配合模型数据
      const assistResponse = await axiosServices.get(
        "/client/lot/get_ai_guess_list",
        {
          params: {
            ...params,
            guess_type: compareGuessType,
          },
        },
      );
      // 数据筛选逻辑
      const defaultData = defaultResponse.data.data.data;
      const assistData = assistResponse.data.data.data;
      const filteredData: PredictItem[] = [];

      // 从尾部开始遍历
      for (let i = defaultData.length - 1; i >= 0; i--) {
        const defaultItem = defaultData[i];
        const nextPeriod =
          defaultItem?.ext_result?.length > 0
            ? defaultItem.ext_result[0].draw_number
            : "empty";
        const assistItem = assistData.find(
          (item: PredictItem) => item.guess_period === nextPeriod,
        );

        // 第一条数据（最后一期）使用默认模型
        if (i === defaultData.length - 1) {
          filteredData.unshift(defaultItem);
          continue;
        }

        // 获取历史数据来判断是否连续输
        const loseCount = (() => {
          let count = 0;
          for (let j = 0; j < switchStrategy; j++) {
            if (filteredData.length <= j) break;
            const item = filteredData[j];
            const prediction = formatGuessResult(item.guess_result);
            const isLose = !checkThreePeriodsMatch(prediction, item.ext_result);
            if (isLose && item.ai_type.name === defaultItem.ai_type.name) {
              count++;
            } else {
              break;
            }
          }
          return count;
        })();

        // 如果连续输的次数达到切换策略要求，使用配合模型
        if (loseCount >= switchStrategy && assistItem) {
          filteredData.unshift(assistItem);
        } else {
          filteredData.unshift(defaultItem);
        }
      }
      return filteredData;
    };

    useImperativeHandle(ref, () => ({
      refresh: () => fetchData(pageSize),
      getTimeRange: () => timeRange,
    }));

    useEffect(() => {
      fetchData(pageSize);
    }, [
      pageSize,
      timeRange,
      isCompare,
      baseGuessType,
      compareGuessType,
      switchStrategy,
    ]);

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
        setPageSize(9999999); // 当选择日期后，自动将数据量设置为5000
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
            value={String(pageSize)}
            style={{ width: 90 }}
            onChange={(value: string) => {
              const size = parseInt(value);
              if (!isNaN(size) && size > 0) {
                setPageSize(size);
              }
            }}
            options={[
              { value: "10", label: "10条" },
              { value: "50", label: "50条" },
              { value: "100", label: "100条" },
              { value: "200", label: "200条" },
              { value: "500", label: "500条" },
              { value: "1000", label: "1000条" },
              { value: "2000", label: "2000条" },
              { value: "5000", label: "5000条" },
            ]}
            showSearch
            allowClear={false}
            placeholder="请输入数据量"
            filterOption={false}
            onSearch={(value: string) => {
              const size = parseInt(value);
              if (!isNaN(size) && size > 0) {
                setPageSize(size);
              }
            }}
          />

          <Radio.Group value={winType} onChange={handleWinTypeChange}>
            <Radio.Button value="current">当期</Radio.Button>
            <Radio.Button value="two">两期</Radio.Button>
            <Radio.Button value="any">三期</Radio.Button>
          </Radio.Group>

          <RangePicker
            showTime={{ format: "HH:mm" }}
            format="YYYY-MM-DD HH:mm"
            onChange={handleTimeRangeChange}
            style={{ minWidth: "300px" }}
          />

          <span>
            {pageSize}条胜率：
            {loading ? (
              <Spin size="small" />
            ) : (
              `${calculateWinRate(data).toFixed(2)}%（有效数据：${
                data.filter((item) => {
                  if (!item.ext_result || !item.guess_result) return false;
                  if (winType === "current") return item.ext_result.length > 0;
                  if (winType === "two") return item.ext_result.length >= 2;
                  return item.ext_result.length >= 3;
                }).length
              }条）`
            )}
          </span>
        </Space>
      </div>
    );
  },
);

PredictStats.displayName = "PredictStats";

export default PredictStats;
