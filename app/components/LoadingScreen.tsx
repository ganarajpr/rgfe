'use client';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
}

const LoadingScreen = ({ progress = 0, message = 'Loading...' }: LoadingScreenProps) => {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8 max-w-md px-6">
        {/* Logo/Icon Area */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse flex items-center justify-center">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-ping opacity-20"></div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900">
            {message}
          </h2>
          <p className="text-sm text-gray-600">
            This may take a moment...
          </p>
        </div>

        {/* Progress Bar */}
        {progress > 0 && (
          <div className="w-full max-w-xs">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-center text-gray-500 mt-2">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Loading Dots Animation */}
        <div className="flex gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

