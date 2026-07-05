"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getEventFeedback, type FeedbackSentiment } from "@/lib/analytics";
import { ArrowLeft, Star, MessageSquare, Users, BarChart2, Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? "fill-[#EBA814] text-[#EBA814]" : "text-gray-200"}
        />
      ))}
    </span>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 w-6 text-right">{label}</span>
      <Star size={12} className="fill-[#EBA814] text-[#EBA814] flex-shrink-0" />
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#EBA814] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8">{count}</span>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  organization: "Organization",
  content:      "Content Quality",
  venue:        "Venue & Setup",
};

const SENTIMENT_CONFIG = {
  positive: { label: "Positive", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", Icon: TrendingUp },
  neutral:  { label: "Neutral",  color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", Icon: Minus },
  negative: { label: "Negative", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", Icon: TrendingDown },
};

function SentimentCard({ sentiment }: { sentiment: FeedbackSentiment }) {
  const cfg = SENTIMENT_CONFIG[sentiment.sentiment];
  const Icon = cfg.Icon;
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-6 border ${cfg.border}`}>
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-purple-500" />
        <h2 className="text-sm font-bold text-gray-700">AI Sentiment Analysis</h2>
        <span className="ml-auto text-xs text-gray-400 bg-purple-50 px-2 py-0.5 rounded-full">Powered by Claude</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Gauge */}
        <div className={`flex flex-col items-center justify-center px-6 py-4 rounded-xl ${cfg.bg} min-w-[120px]`}>
          <Icon size={28} className={cfg.color} />
          <p className={`text-base font-bold mt-1 ${cfg.color}`}>{cfg.label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{sentiment.positivePercent}%</p>
          <p className="text-xs text-gray-500">positive</p>
        </div>

        {/* Summary + themes */}
        <div className="flex-1 space-y-3">
          <p className="text-sm text-gray-700 leading-relaxed italic">"{sentiment.summary}"</p>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Top Themes</p>
            <div className="flex flex-wrap gap-2">
              {sentiment.topThemes.map((theme) => (
                <span key={theme} className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full font-medium border border-purple-100">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ["eventFeedback", id],
    queryFn: () => getEventFeedback(id),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-500 font-semibold">
          {(error as any)?.response?.data?.error ?? "Could not load feedback."}
        </p>
        <Link href={`/events/${id}`} className="text-[#EBA814] text-sm hover:underline mt-2 block">
          ← Back to Event
        </Link>
      </div>
    );
  }

  const { feedbacks, stats, sentiment, event } = data;
  const catKeys = feedbacks.length > 0
    ? Object.keys(feedbacks[0].categoryRatings ?? {})
    : [];

  // Average per category across all feedbacks
  const catAverages: Record<string, number> = {};
  if (feedbacks.length > 0) {
    const allCatKeys = Array.from(new Set(feedbacks.flatMap(f => Object.keys(f.categoryRatings ?? {}))));
    allCatKeys.forEach((key) => {
      const vals = feedbacks.map(f => (f.categoryRatings as Record<string, number>)[key]).filter(Boolean);
      catAverages[key] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link href={`/events/${id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Back to Event
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feedback Report</h1>
        <p className="text-sm text-gray-500 mt-0.5">{event.title}</p>
      </div>

      {/* AI Sentiment Analysis */}
      {sentiment && <SentimentCard sentiment={sentiment} />}

      {/* Overview card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avg rating */}
          <div className="flex flex-col items-center justify-center text-center px-6 border-b sm:border-b-0 sm:border-r border-gray-100 pb-4 sm:pb-0">
            <p className="text-5xl font-black text-gray-900">{stats.avgRating || "–"}</p>
            <StarDisplay rating={Math.round(stats.avgRating)} size={20} />
            <p className="text-xs text-gray-400 mt-1">Average Rating</p>
          </div>

          {/* Stats */}
          <div className="flex gap-6 flex-1 justify-center sm:justify-start">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Users size={11} /> Responses</p>
            </div>
            {Object.values(catAverages).length > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {(Object.values(catAverages).reduce((a, b) => a + b, 0) / Object.values(catAverages).length).toFixed(1)}
                </p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><BarChart2 size={11} /> Category Avg</p>
              </div>
            )}
          </div>
        </div>

        {/* Distribution */}
        {stats.totalCount > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <RatingBar
                key={n}
                label={String(n)}
                count={stats.distribution[n] ?? 0}
                total={stats.totalCount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Category breakdowns */}
      {Object.keys(catAverages).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Category Ratings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(catAverages).map(([key, avg]) => (
              <div key={key} className="p-4 bg-[#FAFAFA] rounded-xl text-center">
                <p className="text-2xl font-bold text-gray-900">{avg}</p>
                <StarDisplay rating={Math.round(avg)} size={14} />
                <p className="text-xs text-gray-500 mt-1">{CATEGORY_LABELS[key] ?? key}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual feedback */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={16} className="text-gray-400" />
          <h2 className="text-sm font-bold text-gray-700">All Responses</h2>
          <span className="ml-auto text-xs text-gray-400">{stats.totalCount} total</span>
        </div>

        {feedbacks.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="p-4 border border-gray-100 rounded-xl hover:bg-[#FAFAFA] transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#EBA814]/10 flex items-center justify-center text-xs font-bold text-[#EBA814]">
                      {fb.user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{fb.user.name}</span>
                  </div>
                  <StarDisplay rating={fb.rating} size={14} />
                </div>
                {fb.comment && (
                  <p className="text-sm text-gray-600 leading-relaxed ml-10">{fb.comment}</p>
                )}
                {Object.keys(fb.categoryRatings ?? {}).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-10">
                    {Object.entries(fb.categoryRatings as Record<string, number>).map(([k, v]) => (
                      <span key={k} className="text-xs px-2 py-0.5 bg-[#EBA814]/10 text-[#EBA814] rounded-full font-medium">
                        {CATEGORY_LABELS[k] ?? k}: {v}★
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2 ml-10">
                  {new Date(fb.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
