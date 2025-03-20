'use client';
import { Button, Input } from 'antd';
import { useState } from 'react';
import MainLayout from '../components/Layout';

const { TextArea } = Input;

export default function ToolPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{
    a: number;
    b: number;
    c: number;
    d: number;
    Q?: number;
  } | null>(null);
  const [variables, setVariables] = useState({
    x: 0,
    y: 0,
    z: 0,
  });

  const calculateNumbers = (text: string) => {
    // 清理输入，只保留数字
    const cleanText = text.replace(/[^0-3]/g, '');
    const numbers = cleanText.split('').map(Number);
    const counts = {
      a: numbers.filter(n => n === 1).length,
      b: numbers.filter(n => n === 2).length,
      c: numbers.filter(n => n === 3).length,
      d: numbers.filter(n => n === 0).length,
    };
    return counts;
  };

  const calculateQ = (counts: { a: number; b: number; c: number; d: number }, vars: typeof variables) => {
    const { x, y, z } = vars;
    const { a, b, c, d } = counts;
    
    return a * (62.7 * x) +
           b * (62.7 * y - 36.3 * x) +
           c * (62.7 * z - 36.3 * (x + y)) -
           d * (36.3 * (x + y + z));
  };

  const handleCalculate = () => {
    const counts = calculateNumbers(input);
    const Q = calculateQ(counts, variables);
    setResult({ ...counts, Q });
  };

  return (
    <MainLayout>
      <div className="p-4 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">请输入数字序列：</label>
            <TextArea
              style={{ width: '300px' }}
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="请输入一串数字..."
            />
          </div>
          
          <div className="grid grid-cols-3 gap-4" style={{ maxWidth: '300px' }}>
            <div>
              <label className="block text-sm font-medium mb-2">X 值：</label>
              <Input
                type="number"
                value={variables.x}
                onChange={(e) => setVariables(prev => ({ ...prev, x: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Y 值：</label>
              <Input
                type="number"
                value={variables.y}
                onChange={(e) => setVariables(prev => ({ ...prev, y: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Z 值：</label>
              <Input
                type="number"
                value={variables.z}
                onChange={(e) => setVariables(prev => ({ ...prev, z: Number(e.target.value) }))}
              />
            </div>
          </div>

          <Button
            type="primary"
            style={{ width: '300px' }}
            onClick={handleCalculate}
          >
            计算
          </Button>

          {result && (
            <div className="mt-4 p-4 border rounded-md" style={{ maxWidth: '300px' }}>
              <h3 className="font-medium mb-2">计算结果：</h3>
              <p>数字1的数量 (a): {result.a}</p>
              <p>数字2的数量 (b): {result.b}</p>
              <p>数字3的数量 (c): {result.c}</p>
              <p>数字0的数量 (d): {result.d}</p>
              <p className="mt-2 font-bold">Q 值: {result.Q?.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
} 