import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { onboardingConfig } from '../../config';
import { Sparkles, ArrowRight, ArrowLeft, Check, X } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, updatePreferences } = useApp();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOnboardingOpen) return null;

  const steps = onboardingConfig.steps;
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleFinish = async () => {
    await updatePreferences({ onboardingCompleted: true });
    setIsOnboardingOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Top ribbon */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Step {currentStepIndex + 1} of {steps.length}
                </span>
              </div>
              {currentStep.badge && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {currentStep.badge}
                </span>
              )}
            </div>
            <button
              onClick={handleFinish}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Body */}
          <div className="space-y-3 py-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {currentStep.title}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {currentStep.description}
            </p>

            {/* Step Highlights */}
            {currentStep.highlights && currentStep.highlights.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {currentStep.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-300"
                  >
                    <span className="text-emerald-500 font-bold shrink-0">✓</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Donate Message (exact wording from CVbuilder on the final step) */}
            {(isLastStep || currentStep.donate) && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-center shadow-xs">
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Please consider{' '}
                  <a
                    href="https://ko-fi.com/thepolygon"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 dark:text-sky-400 underline font-semibold hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                  >
                    donating something
                  </a>{' '}
                  if you liked this project! ☕
                </div>
              </div>
            )}
          </div>

          {/* Stepper Dots */}
          <div className="flex justify-center space-x-1.5 py-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'w-6 bg-emerald-500'
                    : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentStepIndex === 0}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {isLastStep ? (
              <button
                onClick={handleFinish}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/50 transition-all cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
