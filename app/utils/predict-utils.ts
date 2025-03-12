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

export const checkPeriodMatchForOneShot = (prediction: string, drawResult: DrawResult): boolean => {
  if (!prediction || prediction === "暂无结果") return false;

  const firstDigitOfPrediction = prediction[0];
  const lastFourDigits = prediction.slice(1);
  const fullNumberDigits = drawResult.full_number.split('');

  // 否则继续检查原有条件
  const isFirstDigitMatched = fullNumberDigits.includes(firstDigitOfPrediction);
   

  return isFirstDigitMatched;
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

// 赔率常量
export const BETTING_ODDS = 1.315;

// 计算单行的盈亏
export interface BetResult {
  profit: number;  // 盈亏金额
  betDetails: string; // 下注详情，用于展示
}

export const calculateBetProfit = (prediction: string, drawResults: DrawResult[] | null): BetResult => {
  if (!drawResults || drawResults.length === 0 || !prediction || prediction === "暂无结果") {
    return {
      profit: 0,
      betDetails: "等待开奖"
    };
  }

  // 添加长度检查，必须等于3才计算
  if (drawResults.length !== 3) {
    return {
      profit: 0,
      betDetails: "等待开奖"
    };
  }

  let currentBet = 10; // 初始下注金额
  let totalProfit = 0; // 总盈亏
  let betDetails = [];
  let lossCount = 0; // 记录连续输的次数
  let hasWon = false; // 记录是否已经中奖

  // 遍历三期开奖结果
  for (let i = 0; i < 3; i++) {
    // 如果已经中奖，不再继续下注
    if (hasWon) {
      break;
    }

    const isWin = checkPeriodMatch(prediction, drawResults[i]);
    // const isWin = checkPeriodMatchForOneShot(prediction, drawResults[i]);
    
    if (isWin) {
      // 赢了，获得赔率倍数的收益
      const winAmount = Math.floor(currentBet * BETTING_ODDS * 100) / 100; // 保留两位小数
      totalProfit += winAmount; // 加上赢得的金额
      betDetails.push(`+${winAmount}`);
      hasWon = true; // 标记已经中奖
    } else {
      totalProfit -= currentBet; // 输了，损失下注金额
      betDetails.push(`-${currentBet}`);
      lossCount++; // 增加连续输的次数
      currentBet = 10 + (lossCount * 10); // 每次输了增加10，第一次输后20，第二次输后30
    }
  }

  return {
    profit: Math.floor(totalProfit * 100) / 100, // 保留两位小数
    betDetails: betDetails.join(" → ")
  };
};

// 计算多行数据的总盈亏
export const calculateTotalProfit = (data: any[]): number => {
  const total = data.reduce((total, item) => {
    const betResult = calculateBetProfit(
      formatGuessResult(item.guess_result),
      item.ext_result
    );
    return total + betResult.profit;
  }, 0);
  
  return Math.floor(total); // 返回整数
};
