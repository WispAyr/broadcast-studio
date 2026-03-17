import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-4">Broadcast Studio</h1>
        <p className="text-xl text-gray-400 mb-12">Multi-screen studio control system</p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/control"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Control Panel
          </Link>
          <Link
            to="/login"
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg border border-gray-700 transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
