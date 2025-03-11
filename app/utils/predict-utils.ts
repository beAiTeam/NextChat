// 预测结果类型定义
export interface GuessResult {
  top_1_number: number;
  top_2_number: number;
  top_3_number: number;
  top_4_number: number;
  top_5_number: number;
}

// 开奖结果类型定义
export interface DrawResult {
  draw_time: number;
  full_number: string;
  draw_number: string;
}

// 格式化预测结果
export const formatGuessResult = (result: GuessResult | null): string => {
  if (!result) return "暂无结果";
  return `${result.top_1_number}${result.top_2_number}${result.top_3_number}${result.top_4_number}${result.top_5_number}`;
};

// 检查单期是否中奖
export const checkPeriodMatch = (prediction: string, drawResult: DrawResult): boolean => {
  if (!prediction || prediction === "暂无结果") return false;

  const firstDigitOfPrediction = prediction[0];
  const lastFourDigits = prediction.slice(1);
  const fullNumberDigits = drawResult.full_number.split('');

  // 否则继续检查原有条件
  const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
  const isAnyLastFourDigitsMatched = lastFourDigits.split('').some(digit =>
    fullNumberDigits.includes(digit)
  );

  return isFirstDigitMatched && isAnyLastFourDigitsMatched;
};

// 检查当期是否中奖
export const checkCurrentPeriodMatch = (prediction: string, drawResults: DrawResult[] | null, guessPeriod: string): boolean => {
  if (!drawResults || drawResults.length === 0) return false;
  if (!prediction || prediction === "暂无结果") return false;

  // 只检查期号相同的那组开奖结果
  const matchedDrawResult = drawResults.find(drawResult =>
    drawResult.draw_number === guessPeriod
  );

  if (!matchedDrawResult) return false;

  return checkPeriodMatch(prediction, matchedDrawResult);
};

// 检查三期内是否中奖
export const checkThreePeriodsMatch = (prediction: string, drawResults: DrawResult[] | null): boolean => {
  if (!drawResults || drawResults.length === 0) return false;
  if (!prediction || prediction === "暂无结果") return false;

  return drawResults.some(drawResult => checkPeriodMatch(prediction, drawResult));
};

// 检查两期内是否中奖
export const checkTwoPeriodsMatch = (prediction: string, drawResults: DrawResult[] | null): boolean => {
  if (!drawResults || drawResults.length === 0) return false;
  if (!prediction || prediction === "暂无结果") return false;

  // 只取前两期的开奖结果进行判断
  const twoPeriodsResults = drawResults.slice(0, 2);
  return twoPeriodsResults.some(drawResult => checkPeriodMatch(prediction, drawResult));
};
