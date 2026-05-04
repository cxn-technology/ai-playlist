"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useMemo } from "react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

export function EnergyCurveChart({
  energyFlow,
  durationHours
}: {
  energyFlow: string;
  durationHours: number;
}) {
  const chartData = useMemo(() => {
    // Generate simulated data points based on duration and energy flow
    // We'll generate 4 segments / points per hour
    const pointsCount = durationHours * 4 + 1;
    const labels = Array.from({ length: pointsCount }).map((_, i) => {
      const hours = Math.floor(i / 4);
      const mins = (i % 4) * 15;
      return `${hours}:${mins.toString().padStart(2, "0")}`;
    });

    let data: number[] = [];

    // Simple heuristic logic to simulate different energy profiles
    if (energyFlow === "peak-valley") {
      // Hour 1: 0.4, Hour 2: 0.8, Hour 3: 0.5, Hour 4: 0.9 (assuming 4 hours)
      // We interpolate a sine-like wave
      data = labels.map((_, i) => {
        const progress = i / (pointsCount - 1);
        // A simple math function to simulate peaks and valleys
        return 0.4 + 0.4 * Math.sin(progress * Math.PI * 2.5) + (progress * 0.2);
      });
    } else if (energyFlow === "build-up") {
      data = labels.map((_, i) => {
        const progress = i / (pointsCount - 1);
        return 0.3 + (progress * 0.6); // linear build from 0.3 to 0.9
      });
    } else {
      // steady
      data = labels.map(() => 0.6 + (Math.random() * 0.1 - 0.05));
    }

    // Clamp values
    data = data.map(v => Math.max(0, Math.min(1, v)));

    return {
      labels,
      datasets: [
        {
          fill: true,
          label: "Target Energy Level",
          data,
          borderColor: "rgba(59, 130, 246, 1)", // primary blue
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          tension: 0.4,
          pointRadius: 0,
          pointHitRadius: 20,
        },
      ],
    };
  }, [energyFlow, durationHours]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        backgroundColor: "rgba(15, 23, 42, 0.9)", // slate-900
        titleColor: "rgba(248, 250, 252, 1)", // slate-50
        bodyColor: "rgba(148, 163, 184, 1)", // slate-400
        borderColor: "rgba(51, 65, 85, 1)", // slate-700
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 1,
        grid: {
          color: "rgba(51, 65, 85, 0.3)", // slate-700
        },
        ticks: {
          color: "rgba(148, 163, 184, 1)", // slate-400
        },
        title: {
          display: true,
          text: "Energy Level",
          color: "rgba(148, 163, 184, 1)",
        }
      },
      x: {
        grid: {
          color: "rgba(51, 65, 85, 0)", // hide x grid
        },
        ticks: {
          color: "rgba(148, 163, 184, 1)",
          maxTicksLimit: 8,
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      axis: "x" as const,
      intersect: false,
    },
  };

  return (
    <div className="w-full h-[300px] bg-slate-900 p-4 rounded-xl border border-slate-800">
      <Line data={chartData} options={options} />
    </div>
  );
}

