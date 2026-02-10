import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, LogOut } from 'lucide-react';
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

// F1 Team Colors
const TEAM_COLORS = {
  'Red Bull Racing': '#3671C6',
  'Ferrari': '#E8002D',
  'Mercedes': '#27F4D2',
  'McLaren': '#FF8000',
  'Aston Martin': '#229971',
  'Alpine': '#FF87BC',
  'Williams': '#64C4FF',
  'Racing Bulls': '#6692FF',
  'Kick Sauber': '#52E252',
  'Haas F1 Team': '#B6BABD',
};

// Team display order (approximate constructor standings)
const TEAM_ORDER = [
  'McLaren', 'Ferrari', 'Red Bull Racing', 'Mercedes',
  'Aston Martin', 'Alpine', 'Haas F1 Team', 'Racing Bulls',
  'Williams', 'Kick Sauber',
];

// Team emblem SVG components — abstract/geometric designs, not real logos
const TeamEmblem = ({ team, size = 28 }) => {
  const color = TEAM_COLORS[team] || '#38384A';
  const emblems = {
    'Red Bull Racing': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M4 22C4 22 8 10 16 8C20 7 26 10 28 14L24 18L20 16L16 20L12 17L8 22H4Z" fill={color} />
        <circle cx="22" cy="12" r="1.5" fill={color} />
      </svg>
    ),
    'Ferrari': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4C16 4 12 8 12 14V26H14V20L16 16L18 20V26H20V14C20 8 16 4 16 4Z" fill={color} />
        <path d="M12 14H10L8 18H12Z" fill={color} />
        <path d="M20 14H22L24 18H20Z" fill={color} />
      </svg>
    ),
    'Mercedes': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="11" stroke={color} strokeWidth="2" fill="none" />
        <path d="M16 5L16 16L6.5 21.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M16 16L25.5 21.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    'McLaren': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M4 20C4 20 8 10 16 10C24 10 28 20 28 20" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M8 16C8 16 12 12 16 12C20 12 24 16 24 16" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
    'Aston Martin': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M2 18L10 14L16 8L22 14L30 18L26 18L22 16L16 12L10 16L6 18Z" fill={color} />
        <rect x="14" y="18" width="4" height="6" rx="1" fill={color} />
      </svg>
    ),
    'Alpine': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 6L26 24H6L16 6Z" fill={color} opacity="0.3" />
        <path d="M16 12L22 24H10L16 12Z" fill={color} />
        <path d="M12 20H20" stroke="#15151E" strokeWidth="1.5" />
      </svg>
    ),
    'Williams': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M6 8L10 24L13 14L16 24L19 14L22 24L26 8" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    'Racing Bulls': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M8 20C8 20 10 14 16 12C20 11 24 14 26 16L22 18L18 16L14 19L10 17L8 20Z" fill={color} />
        <circle cx="20" cy="13" r="1" fill={color} />
      </svg>
    ),
    'Kick Sauber': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M22 8C18 8 14 10 14 14C14 16 16 18 18 18C14 18 10 20 10 24" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    ),
    'Haas F1 Team': (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M8 6V26M24 6V26M8 16H24" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  };
  return emblems[team] || null;
};

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

// Medal icon component — gold, silver, bronze
const MedalIcon = ({ type, size = 16 }) => {
  const colors = {
    gold: { main: '#FFD700', shadow: '#B8960C', ribbon: '#E10600' },
    silver: { main: '#C0C0C0', shadow: '#808080', ribbon: '#3671C6' },
    bronze: { main: '#CD7F32', shadow: '#8B5A1E', ribbon: '#229971' },
  };
  const c = colors[type];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M8 2L10 6L12 2" stroke={c.ribbon} strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="12" r="6" fill={c.main} />
      <circle cx="10" cy="12" r="4.5" stroke={c.shadow} strokeWidth="0.8" fill="none" />
      <circle cx="10" cy="12" r="2" fill={c.shadow} opacity="0.3" />
    </svg>
  );
};

// Podium stats display for a driver
const PodiumStats = ({ podiums }) => {
  if (!podiums || (podiums[0] === 0 && podiums[1] === 0 && podiums[2] === 0)) {
    return <span className="text-gray-500 text-xs font-f1">—</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {[
        { idx: 0, type: 'gold' },
        { idx: 1, type: 'silver' },
        { idx: 2, type: 'bronze' },
      ].map(({ idx, type }) => (
        podiums[idx] > 0 && (
          <div key={type} className="flex items-center gap-0.5">
            <MedalIcon type={type} size={14} />
            <span className="text-xs font-bold text-white f1-mono">{podiums[idx]}</span>
          </div>
        )
      ))}
    </div>
  );
};

// Checkered stripe component — proper checkered flag with alternating rows
const CheckeredStripe = ({ rows = 2, squareSize = 8, className = '' }) => {
  const totalHeight = rows * squareSize;
  return (
    <div className={`w-full overflow-hidden ${className}`} style={{ height: `${totalHeight}px` }}>
      <svg width="100%" height={totalHeight} preserveAspectRatio="none">
        <defs>
          <pattern id="checkeredFlag" width={squareSize * 2} height={squareSize * 2} patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width={squareSize} height={squareSize} fill="#ffffff" />
            <rect x={squareSize} y="0" width={squareSize} height={squareSize} fill="#15151E" />
            <rect x="0" y={squareSize} width={squareSize} height={squareSize} fill="#15151E" />
            <rect x={squareSize} y={squareSize} width={squareSize} height={squareSize} fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height={totalHeight} fill="url(#checkeredFlag)" />
      </svg>
    </div>
  );
};

// Racing helmet SVG icon
const HelmetIcon = ({ size = 32, color = '#E10600' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6 20C6 12 10 6 18 6C24 6 28 10 28 16V18C28 19.1 27.1 20 26 20H24L22 24H10L8 20H6Z"
      fill={color}
    />
    <path
      d="M12 14H24C24 11 22 8 18 8C14 8 12 11 12 14Z"
      fill="#15151E"
      opacity="0.6"
    />
    <rect x="10" y="20" width="12" height="2" rx="0.5" fill="#15151E" opacity="0.4" />
    <path
      d="M6 20C5 20 4 19.5 4 18C4 17 4.5 16.5 6 16.5"
      stroke={color}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

// Starting lights panel component — 5 circles that animate on sequentially
const StartingLights = () => (
  <div className="flex flex-col items-center mb-6">
    {/* Gantry housing */}
    <div className="bg-[#1a1a24] border border-f1-muted rounded-sm px-4 py-3 flex gap-3 shadow-lg">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="flex flex-col items-center gap-1"
        >
          {/* Light housing */}
          <div className="bg-[#0d0d14] rounded-full p-1.5 border border-[#2a2a3a]">
            <div
              className="w-6 h-6 rounded-full starting-light"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          </div>
        </div>
      ))}
    </div>
    {/* Gantry arm */}
    <div className="w-2 h-4 bg-[#1a1a24] border-x border-f1-muted" />
    <div className="w-32 h-1 bg-[#1a1a24] border border-f1-muted rounded-sm" />
  </div>
);

// Position badge component
const PosBadge = ({ pos, size = 'sm' }) => {
  const colors = {
    1: 'bg-f1-red text-white',
    2: 'bg-gray-500 text-white',
    3: 'bg-amber-700 text-white',
  };
  const sizes = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5 font-bold',
  };
  return (
    <span className={`${colors[pos] || 'bg-f1-muted text-gray-300'} ${sizes[size]} font-bold uppercase tracking-wider inline-block`}>
      P{pos}
    </span>
  );
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

  const getDriverCode = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.code : driverId?.substring(0, 3).toUpperCase();
  };

  const getDriverTeam = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.team : null;
  };

  const getTeamColor = (driverId) => {
    const team = getDriverTeam(driverId);
    return team ? (TEAM_COLORS[team] || '#38384A') : '#38384A';
  };

  const getDriverPodiums = () => {
    const podiums = {};
    Object.keys(results).forEach(round => {
      if (results[round]?.podium) {
        results[round].podium.forEach((driverId, i) => {
          if (!podiums[driverId]) podiums[driverId] = [0, 0, 0];
          podiums[driverId][i]++;
        });
      }
    });
    return podiums;
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
    return {
      'Robert': '#E10600',
      'Johan': '#3671C6',
      'Fredrik': '#27F4D2',
      'Klas': '#FF8000',
    };
  };

  const tabs = [
    { key: 'predict', label: 'Vote' },
    { key: 'predictions', label: 'Votes' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'leaderboard', label: 'Standings' },
    { key: 'teams', label: 'Teams' },
  ];

  // ===================== LOADING SCREEN =====================
  if (loading) {
    return (
      <div className="min-h-screen bg-f1-dark flex flex-col items-center justify-center checkered-bg">
        <div className="fixed top-0 left-0 right-0 h-1 bg-f1-red z-10" />
        <div className="relative z-10">
          <StartingLights />
          <div className="text-white text-sm font-f1 uppercase tracking-[0.3em] text-center">Loading F1 Data</div>
        </div>
      </div>
    );
  }

  // ===================== ERROR SCREEN =====================
  if (apiError) {
    return (
      <div className="min-h-screen bg-f1-dark flex items-center justify-center p-4 checkered-bg">
        <div className="fixed top-0 left-0 right-0 h-1 bg-f1-red z-10" />
        <div className="bg-f1-card border-l-4 border-f1-red p-8 max-w-md w-full relative z-10 speed-stripes">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-f1-red flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-black">!</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-white font-f1 uppercase tracking-wider mb-2">Red Flag</h2>
              <p className="text-sm text-white font-f1 uppercase tracking-wider mb-1">Failed to Load F1 Data</p>
              <p className="text-gray-400 text-sm mb-6">{apiError}</p>
              <button
                onClick={loadData}
                className="bg-f1-red hover:bg-red-700 text-white font-bold font-f1 uppercase tracking-wider py-3 px-6 transition text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===================== LOGIN SCREEN =====================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-f1-dark flex items-center justify-center p-4 checkered-bg">
        <div className="fixed top-0 left-0 right-0 h-1 bg-f1-red z-10" />
        <div className="bg-f1-card max-w-md w-full relative z-10 speed-stripes">
          <CheckeredStripe rows={3} squareSize={6} />
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-black text-white font-f1 uppercase tracking-wider">
                F1 <span className="text-f1-red">Prediction</span> League
              </h1>
              <p className="text-gray-400 font-f1 uppercase tracking-wider text-sm mt-2">2026 Season</p>
            </div>

            <div className="mb-5">
              <label className="block text-white font-f1 uppercase tracking-wider text-xs mb-2">Select User</label>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setLoginError('');
                }}
                className="w-full p-3 bg-f1-surface border border-f1-muted text-white focus:outline-none focus:border-f1-red"
              >
                <option value="">Choose your username...</option>
                {USERS.map(user => (
                  <option key={user.username} value={user.username}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-white font-f1 uppercase tracking-wider text-xs mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your password"
                className="w-full p-3 bg-f1-surface border border-f1-muted text-white focus:outline-none focus:border-f1-red"
              />
            </div>

            <div className="mb-5">
              <label className="flex items-center text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 mr-2 accent-[#E10600]"
                />
                <span className="text-sm font-f1 uppercase tracking-wider">Remember me</span>
              </label>
            </div>

            {loginError && (
              <div className="mb-5 p-3 bg-f1-surface border-l-4 border-f1-red text-red-200 text-sm font-f1">
                {loginError}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-f1-red hover:bg-red-700 text-white font-bold font-f1 uppercase tracking-wider py-3 transition text-sm"
            >
              Login
            </button>

          </div>
        </div>
      </div>
    );
  }

  // ===================== MAIN APP =====================
  return (
    <div className="min-h-screen bg-f1-dark checkered-bg">
      {/* Top red accent line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-f1-red z-50" />

      <div className="max-w-6xl mx-auto p-4 pt-5 relative z-10">
        {/* Header */}
        <div className="bg-f1-card mb-6">
          <div className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white font-f1 uppercase tracking-wider">
                  F1 <span className="text-f1-red">Prediction</span> League
                </h1>
                <p className="text-gray-400 text-sm font-f1 uppercase tracking-wider">
                  2026 Season — {currentUser}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {nextRace && (
                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-f1 uppercase tracking-wider">Next Race</div>
                    <div className="text-base md:text-lg font-bold text-white font-f1">{nextRace.name}</div>
                    <div className="text-xs text-gray-400">{nextRace.circuit}</div>
                  </div>
                )}
                <div className="w-1 h-10 bg-f1-red" />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-white text-xs font-f1 uppercase tracking-wider transition flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          </div>
          <CheckeredStripe rows={2} squareSize={5} />
        </div>

        {/* Tab Navigation — single row with bottom border active indicator */}
        <div className="flex border-b border-f1-muted mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-5 font-f1 uppercase tracking-wider text-sm font-bold transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'text-white border-b-2 border-f1-red'
                  : 'text-gray-400 hover:text-white border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===================== PREDICT TAB ===================== */}
        {activeTab === 'predict' && nextRace && (
          <div className="bg-f1-card p-6">
            <h2 className="text-xl md:text-2xl font-black text-white font-f1 uppercase tracking-wider mb-5">
              {nextRace.name} <span className="text-gray-400 font-bold">R{nextRace.round.padStart(2, '0')}</span>
            </h2>

            {isPredictionLocked() ? (
              <div className="bg-f1-surface border-l-4 border-yellow-500 p-3 md:p-4 mb-6">
                <div className="flex items-center text-yellow-200 text-sm">
                  <Lock className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="font-f1 uppercase tracking-wider font-bold">Voting locked — Qualifying has started</span>
                </div>
              </div>
            ) : (
              <div className="bg-f1-surface border-l-4 border-green-500 p-3 md:p-4 mb-6">
                <div className="flex items-center text-green-200 text-sm">
                  <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="font-f1 uppercase tracking-wider font-bold">Voting open until qualifying starts</span>
                </div>
              </div>
            )}

            {predictions[nextRace.round]?.[currentUser] && (
              <div className="bg-f1-surface border-l-4 border-blue-500 p-3 md:p-4 mb-6">
                <p className="text-blue-200 font-f1 uppercase tracking-wider text-xs font-bold mb-2">Your current vote</p>
                <div className="text-white text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <PosBadge pos={1} size="xs" />
                    <span>{getDriverName(predictions[nextRace.round][currentUser].first)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PosBadge pos={2} size="xs" />
                    <span>{getDriverName(predictions[nextRace.round][currentUser].second)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PosBadge pos={3} size="xs" />
                    <span>{getDriverName(predictions[nextRace.round][currentUser].third)}</span>
                  </div>
                </div>
              </div>
            )}

            {drivers.length === 0 ? (
              <div className="bg-f1-surface border-l-4 border-yellow-500 p-3 md:p-4 mb-6">
                <p className="text-yellow-200 font-f1 uppercase tracking-wider text-xs font-bold">
                  Driver list not yet available. The driver data will appear once the season is closer.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { key: 'first', pos: 1 },
                  { key: 'second', pos: 2 },
                  { key: 'third', pos: 3 },
                ].map(({ key, pos }) => (
                  <div key={key}>
                    <label className="flex items-center gap-2 mb-2">
                      <PosBadge pos={pos} size="sm" />
                    </label>
                    <div className="flex">
                      <div
                        className="w-1.5 flex-shrink-0 transition-colors"
                        style={{ backgroundColor: prediction[key] ? getTeamColor(prediction[key]) : '#38384A' }}
                      />
                      <select
                        value={prediction[key]}
                        onChange={(e) => setPrediction({ ...prediction, [key]: e.target.value })}
                        disabled={isPredictionLocked()}
                        className="w-full p-3 bg-f1-surface border border-f1-muted border-l-0 text-white focus:outline-none focus:border-f1-red disabled:opacity-50 text-sm"
                      >
                        <option value="">Select driver</option>
                        {drivers.map(driver => (
                          <option key={driver.id} value={driver.id}>
                            {driver.code} — {driver.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}

                <button
                  onClick={submitPrediction}
                  disabled={isPredictionLocked()}
                  className="w-full bg-f1-red hover:bg-red-700 text-white font-bold font-f1 uppercase tracking-wider py-3 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {predictions[nextRace.round]?.[currentUser] ? 'Update Vote' : 'Submit Vote'}
                </button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-f1-muted">
              <p className="text-xs text-gray-400 font-f1 uppercase tracking-wider mb-3 font-bold">Scoring System</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-f1-surface p-3">
                  <div className="text-2xl font-black text-white f1-mono">10</div>
                  <div className="text-xs text-gray-400 font-f1 uppercase tracking-wider">Exact</div>
                </div>
                <div className="bg-f1-surface p-3">
                  <div className="text-2xl font-black text-white f1-mono">5</div>
                  <div className="text-xs text-gray-400 font-f1 uppercase tracking-wider">1 Off</div>
                </div>
                <div className="bg-f1-surface p-3">
                  <div className="text-2xl font-black text-white f1-mono">2</div>
                  <div className="text-xs text-gray-400 font-f1 uppercase tracking-wider">2 Off</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CALENDAR TAB ===================== */}
        {activeTab === 'calendar' && (
          <div>
            <div className="bg-f1-card p-5 mb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white font-f1 uppercase tracking-wider">Race Calendar</h2>
                  <p className="text-gray-400 text-xs font-f1 uppercase tracking-wider mt-1">
                    {Object.keys(results).length} of {allRaces.length} completed
                  </p>
                </div>
                <div className="w-full sm:w-48">
                  <div className="bg-f1-surface h-1.5">
                    <div
                      className="bg-f1-red h-1.5 transition-all duration-300"
                      style={{ width: `${(Object.keys(results).length / allRaces.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-px">
              {allRaces.map((race) => {
                const raceDate = new Date(race.raceStart);
                const isUpcoming = nextRace && race.round === nextRace.round;
                const isPast = new Date() > raceDate;
                const hasResult = results[race.round];

                const borderColor = isUpcoming ? '#E10600' : hasResult ? '#22c55e' : '#38384A';

                return (
                  <div
                    key={race.round}
                    className="bg-f1-card flex"
                  >
                    {/* Round number column */}
                    <div
                      className="w-14 md:w-16 flex-shrink-0 flex items-center justify-center border-l-4"
                      style={{ borderLeftColor: borderColor, backgroundColor: '#1a1a24' }}
                    >
                      <span className="text-gray-400 font-black text-lg f1-mono">
                        {race.round.padStart(2, '0')}
                      </span>
                    </div>

                    {/* Race info */}
                    <div className="flex-1 p-3 md:p-4 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm md:text-base font-bold text-white font-f1 uppercase tracking-wider">{race.name}</h3>
                            {isUpcoming && (
                              <span className="bg-f1-red text-white text-[10px] px-2 py-0.5 font-f1 uppercase tracking-wider font-bold">
                                Next
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">{race.circuit} — {race.country}</p>
                        </div>
                        <div className="text-left sm:text-right flex-shrink-0">
                          <p className="text-white font-semibold text-sm f1-mono">
                            {raceDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>

                      {hasResult && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {results[race.round].podium.map((driverId, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <PosBadge pos={i + 1} size="xs" />
                              <span className="text-white text-xs font-bold f1-mono">{getDriverCode(driverId)}</span>
                            </div>
                          ))}
                          {(() => {
                            const raceWinner = getRaceWinner(race.round);
                            if (raceWinner) {
                              return (
                                <span className="text-gray-400 text-xs ml-auto">
                                  Best: <span className="text-white font-bold">{raceWinner.users.join(', ')}</span> <span className="f1-mono">{raceWinner.score} PTS</span>
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== LEADERBOARD TAB ===================== */}
        {activeTab === 'leaderboard' && (
          <div>
            <div className="bg-f1-card p-6 mb-4">
              <h2 className="text-xl md:text-2xl font-black text-white font-f1 uppercase tracking-wider">Championship Standings</h2>
            </div>

            {leaderboard.length === 0 ? (
              <div className="bg-f1-card p-8">
                <p className="text-gray-400 text-center font-f1 uppercase tracking-wider text-sm">No scores yet. Start voting!</p>
              </div>
            ) : (
              <>
                <div className="space-y-px mb-6">
                  {leaderboard.map((entry, index) => {
                    const userColor = getUserColors()[entry.user] || '#38384A';
                    return (
                      <div
                        key={entry.user}
                        className="bg-f1-card flex items-center p-4 gap-4"
                      >
                        <PosBadge pos={index + 1} size="md" />
                        <div
                          className="w-1 h-8 flex-shrink-0"
                          style={{ backgroundColor: userColor }}
                        />
                        <span className="text-base md:text-lg font-bold text-white font-f1 uppercase tracking-wider flex-1 min-w-0 truncate">
                          {entry.user}
                        </span>
                        <span className="text-lg md:text-xl font-black text-white f1-mono flex-shrink-0">
                          {entry.score} <span className="text-gray-400 text-sm">PTS</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {getChartData().length > 0 && (
                  <div className="bg-f1-card p-5">
                    <h3 className="text-lg font-bold text-white font-f1 uppercase tracking-wider mb-4">Points Progression</h3>
                    <div className="bg-f1-surface p-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={getChartData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#38384A" />
                          <XAxis
                            dataKey="round"
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis
                            stroke="#6b7280"
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F1F27',
                              border: '1px solid #38384A',
                              borderRadius: '0px',
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

        {/* ===================== CURRENT VOTES TAB ===================== */}
        {activeTab === 'predictions' && nextRace && (
          <div>
            <div className="bg-f1-card p-6 mb-4">
              <h2 className="text-xl md:text-2xl font-black text-white font-f1 uppercase tracking-wider">
                Current Votes <span className="text-gray-400 font-bold text-base">— {nextRace.name}</span>
              </h2>
            </div>

            {!predictions[nextRace.round] || Object.keys(predictions[nextRace.round]).length === 0 ? (
              <div className="bg-f1-card p-8">
                <p className="text-gray-400 text-center font-f1 uppercase tracking-wider text-sm">No votes yet for this race.</p>
              </div>
            ) : (
              <div className="space-y-px">
                {Object.keys(predictions[nextRace.round]).map(user => {
                  const userColor = getUserColors()[user] || '#38384A';
                  const userPrediction = predictions[nextRace.round][user];
                  return (
                    <div key={user} className="bg-f1-card">
                      {/* User header bar */}
                      <div className="flex items-center gap-3 bg-f1-surface px-4 py-2">
                        <div className="w-1 h-5" style={{ backgroundColor: userColor }} />
                        <h3 className="text-sm font-bold text-white font-f1 uppercase tracking-wider">{user}</h3>
                      </div>
                      {/* Predictions grid */}
                      <div className="grid grid-cols-3 divide-x divide-f1-muted">
                        {[
                          { key: 'first', pos: 1 },
                          { key: 'second', pos: 2 },
                          { key: 'third', pos: 3 },
                        ].map(({ key, pos }) => {
                          const driverId = userPrediction[key];
                          const teamColor = getTeamColor(driverId);
                          return (
                            <div key={key} className="p-3 text-center">
                              <div className="mb-1"><PosBadge pos={pos} size="xs" /></div>
                              <div className="text-white font-black text-lg f1-mono" style={{ color: teamColor }}>
                                {getDriverCode(driverId)}
                              </div>
                              <div className="text-gray-400 text-[10px] font-f1 uppercase tracking-wider truncate">
                                {getDriverTeam(driverId) || ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {results[nextRace.round] && (
              <div className="mt-4 bg-f1-card border-l-4 border-green-500">
                <div className="px-4 py-2 bg-f1-surface">
                  <h3 className="text-sm font-bold text-green-400 font-f1 uppercase tracking-wider">Actual Result</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-f1-muted">
                  {results[nextRace.round].podium.map((driverId, i) => {
                    const teamColor = getTeamColor(driverId);
                    return (
                      <div key={i} className="p-3 text-center">
                        <div className="mb-1"><PosBadge pos={i + 1} size="xs" /></div>
                        <div className="text-white font-black text-lg f1-mono" style={{ color: teamColor }}>
                          {getDriverCode(driverId)}
                        </div>
                        <div className="text-gray-400 text-[10px] font-f1 uppercase tracking-wider truncate">
                          {getDriverTeam(driverId) || ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TEAMS TAB ===================== */}
        {activeTab === 'teams' && (
          <div>
            <div className="bg-f1-card p-6 mb-4">
              <h2 className="text-xl md:text-2xl font-black text-white font-f1 uppercase tracking-wider">Teams & Drivers</h2>
              <p className="text-gray-400 text-xs font-f1 uppercase tracking-wider mt-1">
                2026 Season — {Object.keys(TEAM_COLORS).length} Teams
              </p>
            </div>

            {drivers.length === 0 ? (
              <div className="bg-f1-card p-8">
                <p className="text-gray-400 text-center font-f1 uppercase tracking-wider text-sm">
                  Driver data not yet available. Check back closer to the season.
                </p>
              </div>
            ) : (() => {
              const driverPodiums = getDriverPodiums();
              return (
                <div className="space-y-px">
                  {TEAM_ORDER
                    .filter(teamName => drivers.some(d => d.team === teamName))
                    .map(teamName => {
                      const teamColor = TEAM_COLORS[teamName] || '#38384A';
                      const teamDrivers = drivers.filter(d => d.team === teamName);
                      return (
                        <div key={teamName} className="bg-f1-card">
                          {/* Team header */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 bg-f1-surface border-l-4"
                            style={{ borderLeftColor: teamColor }}
                          >
                            <TeamEmblem team={teamName} size={28} />
                            <h3 className="text-sm md:text-base font-bold text-white font-f1 uppercase tracking-wider flex-1">
                              {teamName}
                            </h3>
                          </div>
                          {/* Drivers */}
                          {teamDrivers.map(driver => (
                            <div key={driver.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-f1-muted/30">
                              <span
                                className="text-xs font-black f1-mono w-8 text-right flex-shrink-0"
                                style={{ color: teamColor }}
                              >
                                #{driver.number}
                              </span>
                              <span
                                className="text-sm font-black f1-mono w-12 flex-shrink-0"
                                style={{ color: teamColor }}
                              >
                                {driver.code}
                              </span>
                              <span className="text-sm text-white font-f1 flex-1">{driver.name}</span>
                              <PodiumStats podiums={driverPodiums[driver.id] || [0, 0, 0]} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Footer accent */}
        <div className="mt-8 mb-4">
          <CheckeredStripe rows={2} squareSize={5} />
        </div>
      </div>
    </div>
  );
};

export default F1PredictionApp;
