import { Table } from "antd";
import { toast } from "react-hot-toast";
import { DrawResult, checkPeriodMatch } from "../../utils/predict-utils";

interface PredictDetailsTableProps {
  detailsData: any[];
}

const PredictDetailsTable = ({ detailsData }: PredictDetailsTableProps) => {
  // 详情表格列定义
  const detailColumns = [
    {
      title: "时间",
      dataIndex: "time",
      key: "time",
      width: 180,
    },
    {
      title: "期号",
      dataIndex: "period",
      key: "period",
      width: 100,
    },
    {
      title: "预测号码",
      dataIndex: "prediction",
      key: "prediction",
      width: 100,
      render: (resultText: string, record: any) => {
        if (resultText === "暂无结果") return resultText;

        return (
          <span
            style={{ cursor: "pointer" }}
            onClick={() => {
              navigator.clipboard.writeText(resultText);
              toast.success("已复制到剪贴板");
            }}
          >
            {resultText.split("").map((digit, index) => {
              // 判断预测结果中的数字是否在任意一个开奖结果中出现
              let shouldHighlight = false;
              if (record.drawNumbers && record.drawNumbers.length > 0) {
                for (const numberSet of record.drawNumbers) {
                  const numbers = numberSet.map((d: any) => d.number);
                  if (numbers.includes(digit)) {
                    shouldHighlight = true;
                    break;
                  }
                }
              }

              // 新逻辑：第一位数字与正式结果中任意一个数字匹配则标红色，其他位匹配则标绿色
              const isFirstDigit = index === 0;

              return (
                <span
                  key={index}
                  className={
                    shouldHighlight
                      ? isFirstDigit
                        ? "highlighted-digit-gold"
                        : "highlighted-digit"
                      : "digit"
                  }
                >
                  {digit}
                </span>
              );
            })}
          </span>
        );
      },
    },
    {
      title: "开奖号码",
      dataIndex: "drawNumbers",
      key: "drawNumbers",
      width: 300,
      render: (drawNumbers: any[], record: any) => {
        if (!drawNumbers || drawNumbers.length === 0) {
          return "等待开奖结果";
        }

        const prediction = record.prediction;
        if (prediction === "暂无结果") {
          return "暂无结果";
        }

        return (
          <div>
            {drawNumbers.map((numberSet, resultIndex) => {
              // 构造一个临时的DrawResult对象用于checkPeriodMatch判断
              const fullNumber = numberSet.map((digit: {number: string}) => digit.number).join('');
              const tempDrawResult: DrawResult = {
                full_number: fullNumber,
                draw_number: String(resultIndex),
                draw_time: 0
              };
              
              // 使用checkPeriodMatch判断是否中奖
              const isMatched = checkPeriodMatch(prediction, tempDrawResult);

              return (
                <div
                  key={resultIndex}
                  style={{
                    marginBottom: resultIndex < drawNumbers.length - 1 ? "8px" : "0",
                    padding: "4px 8px",
                    backgroundColor: isMatched ? "#e6f7ff" : "transparent",
                    borderRadius: "4px",
                  }}
                >
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      const numbers = numberSet.map((digit: {number: string}) => digit.number).join('');
                      navigator.clipboard.writeText(numbers);
                      toast.success("已复制到剪贴板");
                    }}
                  >
                    {numberSet.map((digit: {number: string, highlight: boolean}, index: number) => {
                      // 判断开奖结果中的数字是否在预测结果中出现
                      const isCommon = prediction.includes(digit.number);
                      // 如果预测结果的第一位与当前数字匹配，则标红色
                      const isFirstDigitMatch = prediction.length > 0 && digit.number === prediction[0];

                      return (
                        <span
                          key={index}
                          className={
                            isCommon
                              ? isFirstDigitMatch
                                ? "highlighted-digit-gold"
                                : "highlighted-digit"
                              : "digit"
                          }
                        >
                          {digit.number}
                        </span>
                      );
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        );
      }
    },
    {
      title: "盈亏过程",
      dataIndex: "details",
      key: "details",
      width: 200,
    },
    {
      title: "余额变化",
      dataIndex: "balance",
      key: "balance",
      width: 100,
      render: (balance: number) => (
        <span style={{ color: balance >= 0 ? "#52c41a" : "#ff4d4f" }}>
          {balance >= 0 ? "+" : ""}{balance}
        </span>
      ),
    },
    {
      title: "当前余额",
      dataIndex: "currentBalance",
      key: "currentBalance",
      width: 100,
      render: (currentBalance: number) => (
        <span style={{ fontWeight: "bold" }}>
          {currentBalance}
        </span>
      ),
    },
  ];

  return (
    <Table
      dataSource={detailsData}
      columns={detailColumns}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showQuickJumper: true,
      }}
      scroll={{ x: true }}
    />
  );
};

export default PredictDetailsTable; 