import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Lock, CheckCircle, Users, TrendingUp, LogOut, CalendarDays } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// ============================================================================
// FIREBASE CONFIG - REPLACE WITH YOUR OWN VALUES FROM FIREBASE CONSOLE
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCMdarCvrYC50Uuvjvn38YaYGSA7LaoDDc",
  authDomain: "f1-prediction-league.firebaseapp.com",
  projectId: "f1-prediction-league",
  storageBucket: "f1-prediction-league.firebasestorage.app",
  messagingSenderId: "578545754336",
  appId: "1:578545754336:web:591a18c3ec4fd77e777085"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// ============================================================================

// HARDCODED USERS
const USERS = [
  { username: 'Robert', password: '1234' },
  { username: 'Johan', password: '1234' },
  { username: 'Fredrik', password: '1234' },
  { username: 'Klas', password: '1234' }
];

// ============================================================================
// OpenF1 API
// ============================================================================
const OPENF1_BASE = 'https://api.openf1.org/v1';

const fetchWithRetry = async (url, retries = 4) => {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429 && i < retries) {
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      continue;
    }
    throw new Error(`${url.split('/v1/')[1].split('?')[0]} API: ${res.status}`);
  }
};

const fetchOpenF1Data = async () => {
  const [meetings, raceSessions, qualifyingSessions] = await Promise.all([
    fetchWithRetry(`${OPENF1_BASE}/meetings?year=2026`),
    fetchWithRetry(`${OPENF1_BASE}/sessions?year=2026&session_name=Race`),
    fetchWithRetry(`${OPENF1_BASE}/sessions?year=2026&session_name=Qualifying`),
  ]);

  // Try 2026 drivers from the first race session, fall back to latest session
  let drivers = [];
  if (raceSessions.length > 0) {
    drivers = await fetchWithRetry(`${OPENF1_BASE}/drivers?session_key=${raceSessions[0].session_key}`);
  }
  if (!Array.isArray(drivers) || drivers.length === 0) {
    drivers = await fetchWithRetry(`${OPENF1_BASE}/drivers?session_key=latest`);
  }

  return { meetings, raceSessions, qualifyingSessions, drivers };
};

const buildRaceCalendar = (meetings, raceSessions, qualifyingSessions) => {
  const meetingMap = {};
  meetings.forEach(m => { meetingMap[m.meeting_key] = m; });

  const qualiMap = {};
  qualifyingSessions.forEach(q => { qualiMap[q.meeting_key] = q; });

  const races = raceSessions
    .filter(s => meetingMap[s.meeting_key])
    .map(s => {
      const meeting = meetingMap[s.meeting_key];
      const quali = qualiMap[s.meeting_key];
      return {
        name: meeting.meeting_name,
        circuit: meeting.circuit_short_name || meeting.location,
        country: meeting.country_name,
        raceStart: s.date_start,
        qualifyingStart: quali ? quali.date_start : null,
        meetingKey: s.meeting_key,
      };
    })
    .sort((a, b) => new Date(a.raceStart) - new Date(b.raceStart));

  return races.map((race, i) => ({ ...race, round: String(i + 1) }));
};

const buildDriversList = (apiDrivers) => {
  const seen = {};
  return apiDrivers
    .map(d => {
      let id = d.last_name.toLowerCase();
      if (seen[id]) {
        id = `${id}-${d.driver_number}`;
      }
      seen[d.last_name.toLowerCase()] = true;
      return {
        id,
        name: `${d.first_name} ${d.last_name}`,
        code: d.name_acronym,
        number: d.driver_number,
        team: d.team_name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

const F1PredictionApp = () => {
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [nextRace, setNextRace] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [prediction, setPrediction] = useState({ first: '', second: '', third: '' });
  const [predictions, setPredictions] = useState({});
  const [results, setResults] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [allRaces, setAllRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('predict');
  const [loginError, setLoginError] = useState('');
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    const savedUserLocal = localStorage.getItem('f1_logged_in_user');
    const savedUserSession = sessionStorage.getItem('f1_logged_in_user');
    const savedUser = savedUserLocal || savedUserSession;

    if (savedUser) {
      setCurrentUser(savedUser);
      setIsLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (nextRace && predictions[nextRace.round]?.[currentUser]) {
      const existing = predictions[nextRace.round][currentUser];
      setPrediction({
        first: existing.first,
        second: existing.second,
        third: existing.third
      });
    } else {
      setPrediction({ first: '', second: '', third: '' });
    }
  }, [nextRace, predictions, currentUser, results]);

  const loadData = async () => {
    setLoading(true);
    setApiError(null);

    let raceCalendar;
    try {
      const { meetings, raceSessions, qualifyingSessions, drivers: apiDrivers } = await fetchOpenF1Data();
      raceCalendar = buildRaceCalendar(meetings, raceSessions, qualifyingSessions);
      setAllRaces(raceCalendar);
      if (Array.isArray(apiDrivers) && apiDrivers.length > 0) {
        setDrivers(buildDriversList(apiDrivers));
      }
    } catch (err) {
      console.error('OpenF1 API error:', err);
      setApiError(err.message || 'Failed to load F1 data');
      setLoading(false);
      return;
    }

    // Listen to predictions in real-time
    const predictionsRef = doc(db, 'f1data', 'predictions');
    onSnapshot(predictionsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPredictions(data);
      } else {
        setPredictions({});
      }
    });

    // Listen to results in real-time
    const resultsRef = doc(db, 'f1data', 'results');
    onSnapshot(resultsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setResults(data);

        // Find next race
        const upcoming = raceCalendar.find(r => !data[r.round]);
        if (upcoming) {
          setNextRace(upcoming);
        } else {
          setNextRace(raceCalendar[raceCalendar.length - 1]);
        }
      } else {
        setResults({});
        setNextRace(raceCalendar[0]);
      }
    });

    setLoading(false);
  };

  useEffect(() => {
    updateLeaderboard();
  }, [predictions, results]);

  const isPredictionLocked = () => {
    if (!nextRace?.qualifyingStart) return false;
    return new Date() >= new Date(nextRace.qualifyingStart);
  };

  const handleLogin = () => {
    if (!selectedUser) {
      setLoginError('Please select a user');
      return;
    }
    if (!password) {
      setLoginError('Please enter your password');
      return;
    }

    const user = USERS.find(u => u.username === selectedUser);
    if (user && user.password === password) {
      setCurrentUser(selectedUser);
      setIsLoggedIn(true);
      setLoginError('');

      if (rememberMe) {
        localStorage.setItem('f1_logged_in_user', selectedUser);
      } else {
        sessionStorage.setItem('f1_logged_in_user', selectedUser);
      }
    } else {
      setLoginError('Incorrect password');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser('');
    setSelectedUser('');
    setPassword('');
    setRememberMe(false);
    localStorage.removeItem('f1_logged_in_user');
    sessionStorage.removeItem('f1_logged_in_user');
  };

  const submitPrediction = async () => {
    if (isPredictionLocked()) {
      alert('Voting is closed! Qualifying has already started.');
      return;
    }

    if (!prediction.first || !prediction.second || !prediction.third) {
      alert('Please select all three podium positions');
      return;
    }

    if (new Set([prediction.first, prediction.second, prediction.third]).size !== 3) {
      alert('Please select three different drivers');
      return;
    }

    try {
      const newPredictions = { ...predictions };
      if (!newPredictions[nextRace.round]) {
        newPredictions[nextRace.round] = {};
      }
      newPredictions[nextRace.round][currentUser] = {
        first: prediction.first,
        second: prediction.second,
        third: prediction.third,
        timestamp: new Date().toISOString()
      };

      await setDoc(doc(db, 'f1data', 'predictions'), newPredictions);
      alert('Vote submitted successfully!');
    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Error submitting vote: ' + error.message);
    }
  };

  const calculateScore = (predicted, actual) => {
    let score = 0;
    const positions = ['first', 'second', 'third'];

    positions.forEach((pos, idx) => {
      const predictedDriver = predicted[pos];
      const actualPosition = actual.indexOf(predictedDriver);

      if (actualPosition === idx) {
        score += 10;
      } else if (actualPosition !== -1) {
        const positionDiff = Math.abs(actualPosition - idx);
        if (positionDiff === 1) score += 5;
        else if (positionDiff === 2) score += 2;
      }
    });

    return score;
  };

  const updateLeaderboard = () => {
    const userScores = {};

    Object.keys(predictions).forEach(round => {
      if (results[round]) {
        const actualPodium = results[round].podium;
        Object.keys(predictions[round]).forEach(user => {
          if (!userScores[user]) userScores[user] = 0;
          userScores[user] += calculateScore(predictions[round][user], actualPodium);
        });
      }
    });

    const leaderboardData = Object.keys(userScores).map(user => ({
      user,
      score: userScores[user]
    })).sort((a, b) => b.score - a.score);

    setLeaderboard(leaderboardData);
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : driverId;
  };

  const getRaceWinner = (round) => {
    if (!predictions[round] || !results[round]) return null;

    const userScores = {};
    const actualPodium = results[round].podium;

    Object.keys(predictions[round]).forEach(user => {
      userScores[user] = calculateScore(predictions[round][user], actualPodium);
    });

    const maxScore = Math.max(...Object.values(userScores));
    const winners = Object.keys(userScores).filter(user => userScores[user] === maxScore);

    return { users: winners, score: maxScore };
  };

  const getChartData = () => {
    const chartData = [];
    const userCumulativeScores = {};

    const completedRounds = Object.keys(results).sort((a, b) => parseInt(a) - parseInt(b));

    completedRounds.forEach(round => {
      if (predictions[round]) {
        const actualPodium = results[round].podium;
        const roundData = { round: `R${round}` };

        Object.keys(predictions[round]).forEach(user => {
          const score = calculateScore(predictions[round][user], actualPodium);
          if (!userCumulativeScores[user]) {
            userCumulativeScores[user] = 0;
          }
          userCumulativeScores[user] += score;
          roundData[user] = userCumulativeScores[user];
        });

        chartData.push(roundData);
      }
    });

    return chartData;
  };

  const getUserColors = () => {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    const colorMap = {
      'Robert': colors[0],
      'Johan': colors[1],
      'Fredrik': colors[2],
      'Klas': colors[3]
    };
    return colorMap;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading F1 data...</div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-2xl font-bold text-white mb-2">Failed to Load F1 Data</h2>
          <p className="text-gray-400 mb-6">{apiError}</p>
          <button
            onClick={loadData}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-md w-full">
          <div className="flex items-center justify-center mb-6">
            <Trophy className="w-12 h-12 text-red-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-white">F1 Prediction League</h1>
              <p className="text-red-400 font-semibold">2026 Season</p>
            </div>
          </div>
          <p className="text-gray-300 mb-6 text-center">Login to join the competition</p>

          <div className="mb-4">
            <label className="block text-white font-semibold mb-2">Select User</label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setLoginError('');
              }}
              className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Choose your username...</option>
              {USERS.map(user => (
                <option key={user.username} value={user.username}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-white font-semibold mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLoginError('');
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Enter your password"
              className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="mb-4">
            <label className="flex items-center text-white cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500 focus:ring-2 mr-2"
              />
              <span className="text-sm">Remember me on this device</span>
            </label>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded-lg text-red-200 text-sm">
              {loginError}
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
          >
            Login
          </button>

          <div className="mt-6 p-4 bg-gray-700 rounded-lg">
            <p className="text-gray-300 text-sm mb-2">
              <strong>Password for all users: 1234</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-2xl p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center">
                <Trophy className="w-10 h-10 text-red-500 mr-3" />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">F1 Prediction League</h1>
                  <p className="text-gray-400 text-sm md:text-base">2026 Season • Welcome, {currentUser}!</p>
                </div>
              </div>
              {nextRace && (
                <div className="text-right">
                  <div className="text-xs md:text-sm text-gray-400">Next Race</div>
                  <div className="text-base md:text-lg font-bold text-white">{nextRace.name}</div>
                  <div className="text-xs md:text-sm text-gray-400">{nextRace.circuit}</div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition text-xs md:text-sm ml-auto"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => setActiveTab('predict')}
            className={`py-3 px-4 rounded-lg font-semibold transition ${
              activeTab === 'predict' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Calendar className="w-5 h-5 inline mr-2" />
            Vote on Race
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`py-3 px-4 rounded-lg font-semibold transition ${
              activeTab === 'predictions' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <Users className="w-5 h-5 inline mr-2" />
            Current Votes
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`py-3 px-4 rounded-lg font-semibold transition ${
              activeTab === 'calendar' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <CalendarDays className="w-5 h-5 inline mr-2" />
            Race Calendar
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`py-3 px-4 rounded-lg font-semibold transition ${
              activeTab === 'leaderboard' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" />
            Leaderboard
          </button>
        </div>

        {activeTab === 'predict' && nextRace && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-4">
              {nextRace.name} - Round {nextRace.round}
            </h2>

            {isPredictionLocked() ? (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 md:p-4 mb-6">
                <div className="flex items-center text-yellow-200 text-sm md:text-base">
                  <Lock className="w-4 h-4 md:w-5 md:h-5 mr-2 flex-shrink-0" />
                  <span className="font-semibold">Voting is locked! Qualifying has started.</span>
                </div>
              </div>
            ) : (
              <div className="bg-green-900 border border-green-600 rounded-lg p-3 md:p-4 mb-6">
                <div className="flex items-center text-green-200 text-sm md:text-base">
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 mr-2 flex-shrink-0" />
                  <span className="font-semibold">Voting open until qualifying starts</span>
                </div>
              </div>
            )}

            {predictions[nextRace.round]?.[currentUser] && (
              <div className="bg-blue-900 border border-blue-600 rounded-lg p-3 md:p-4 mb-6">
                <p className="text-blue-200 font-semibold mb-2 text-sm md:text-base">Your current vote:</p>
                <div className="text-white text-sm md:text-base">
                  <div>🥇 1st: {getDriverName(predictions[nextRace.round][currentUser].first)}</div>
                  <div>🥈 2nd: {getDriverName(predictions[nextRace.round][currentUser].second)}</div>
                  <div>🥉 3rd: {getDriverName(predictions[nextRace.round][currentUser].third)}</div>
                </div>
              </div>
            )}

            {drivers.length === 0 ? (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 md:p-4 mb-6">
                <p className="text-yellow-200 font-semibold text-sm md:text-base">
                  Driver list not yet available. The driver data will appear once the season is closer.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">🥇 1st Place</label>
                  <select
                    value={prediction.first}
                    onChange={(e) => setPrediction({ ...prediction, first: e.target.value })}
                    disabled={isPredictionLocked()}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 text-sm md:text-base"
                  >
                    <option value="">Select driver</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">🥈 2nd Place</label>
                  <select
                    value={prediction.second}
                    onChange={(e) => setPrediction({ ...prediction, second: e.target.value })}
                    disabled={isPredictionLocked()}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 text-sm md:text-base"
                  >
                    <option value="">Select driver</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white font-semibold mb-2 text-sm md:text-base">🥉 3rd Place</label>
                  <select
                    value={prediction.third}
                    onChange={(e) => setPrediction({ ...prediction, third: e.target.value })}
                    disabled={isPredictionLocked()}
                    className="w-full p-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 text-sm md:text-base"
                  >
                    <option value="">Select driver</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={submitPrediction}
                  disabled={isPredictionLocked()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                >
                  {predictions[nextRace.round]?.[currentUser] ? 'Update Vote' : 'Submit Vote'}
                </button>
              </div>
            )}

            <div className="mt-6 text-xs md:text-sm text-gray-400">
              <p><strong>Scoring System:</strong></p>
              <p>• Correct position: 10 points</p>
              <p>• Right driver, 1 position off: 5 points</p>
              <p>• Right driver, 2 positions off: 2 points</p>
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white">2026 Race Calendar</h2>
                <p className="text-gray-400 text-xs md:text-sm mt-1">
                  {Object.keys(results).length} of {allRaces.length} races completed
                </p>
              </div>
              <div className="text-gray-400 text-sm w-full sm:w-48">
                <div className="bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(Object.keys(results).length / allRaces.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {allRaces.map((race) => {
                const raceDate = new Date(race.raceStart);
                const isUpcoming = nextRace && race.round === nextRace.round;
                const isPast = new Date() > raceDate;
                const hasResult = results[race.round];

                return (
                  <div
                    key={race.round}
                    className={`p-4 rounded-lg border-2 ${
                      isUpcoming
                        ? 'bg-red-900 border-red-500'
                        : isPast
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-700 border-gray-500'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-gray-400 font-bold text-sm">Round {race.round}</span>
                          {isUpcoming && (
                            <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              Next Race
                            </span>
                          )}
                          {hasResult && (
                            <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg md:text-xl font-bold text-white mb-1">{race.name}</h3>
                        <p className="text-gray-300 text-sm">{race.circuit}</p>
                        <p className="text-gray-400 text-xs">{race.country}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-white font-semibold text-sm md:text-base">
                          {new Date(race.raceStart).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        {race.qualifyingStart && (
                          <p className="text-gray-400 text-xs">
                            Quali: {new Date(race.qualifyingStart).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    {hasResult && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <p className="text-green-400 text-xs md:text-sm font-semibold mb-1">Race Result:</p>
                        <div className="text-gray-300 text-xs md:text-sm mb-2 break-words">
                          🥇 {getDriverName(results[race.round].podium[0])} •
                          🥈 {getDriverName(results[race.round].podium[1])} •
                          🥉 {getDriverName(results[race.round].podium[2])}
                        </div>
                        {(() => {
                          const raceWinner = getRaceWinner(race.round);
                          if (raceWinner) {
                            return (
                              <div className="bg-yellow-900 bg-opacity-30 rounded px-2 md:px-3 py-2 mt-2">
                                <p className="text-yellow-400 text-xs md:text-sm font-semibold break-words">
                                  🏆 Best: {raceWinner.users.join(', ')} ({raceWinner.score} pts)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Season Leaderboard</h2>

            {leaderboard.length === 0 ? (
              <p className="text-gray-400 text-center py-8 text-sm md:text-base">No scores yet. Start voting!</p>
            ) : (
              <>
                <div className="mb-8">
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.user}
                        className={`flex items-center justify-between px-4 py-2 rounded-lg border-l-4 ${
                          index === 0 ? 'bg-yellow-900 border-yellow-500' :
                          index === 1 ? 'bg-gray-700 border-gray-400' :
                          index === 2 ? 'bg-orange-900 border-orange-600' :
                          'bg-gray-700 border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg md:text-xl font-bold text-white w-6 flex-shrink-0">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                          </span>
                          <span className="text-base md:text-lg font-semibold text-white truncate">{entry.user}</span>
                        </div>
                        <span className="text-lg md:text-xl font-bold text-red-400 flex-shrink-0">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {getChartData().length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-4">Points Progression</h3>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={getChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis
                            dataKey="round"
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                          />
                          <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value) => <span style={{ color: '#fff' }}>{value}</span>}
                          />
                          {leaderboard.map(entry => (
                            <Line
                              key={entry.user}
                              type="monotone"
                              dataKey={entry.user}
                              stroke={getUserColors()[entry.user]}
                              strokeWidth={2}
                              dot={{ fill: getUserColors()[entry.user], r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'predictions' && nextRace && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-6">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Current Votes - {nextRace.name}</h2>
            {!predictions[nextRace.round] || Object.keys(predictions[nextRace.round]).length === 0 ? (
              <p className="text-gray-400 text-center py-8 text-sm md:text-base">No votes yet for this race.</p>
            ) : (
              <div className="space-y-4">
                {Object.keys(predictions[nextRace.round]).map(user => (
                  <div key={user} className="bg-gray-700 p-3 md:p-4 rounded-lg">
                    <h3 className="text-base md:text-lg font-bold text-white mb-2">{user}</h3>
                    <div className="text-gray-300 space-y-1 text-sm md:text-base">
                      <div>🥇 {getDriverName(predictions[nextRace.round][user].first)}</div>
                      <div>🥈 {getDriverName(predictions[nextRace.round][user].second)}</div>
                      <div>🥉 {getDriverName(predictions[nextRace.round][user].third)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results[nextRace.round] && (
              <div className="mt-6 bg-green-900 border border-green-600 rounded-lg p-4">
                <h3 className="text-lg font-bold text-green-200 mb-2">Actual Result:</h3>
                <div className="text-white space-y-1">
                  <div>🥇 {getDriverName(results[nextRace.round].podium[0])}</div>
                  <div>🥈 {getDriverName(results[nextRace.round].podium[1])}</div>
                  <div>🥉 {getDriverName(results[nextRace.round].podium[2])}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default F1PredictionApp;
