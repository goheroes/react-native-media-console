import React, {useCallback, useState, useEffect, useRef} from 'react';
import {TouchableWithoutFeedback, SafeAreaView} from 'react-native';
import Video, {OnLoadData, OnProgressData} from 'react-native-video';
import {useControlTimeout, useAnimations, usePanResponders} from './hooks';
import {
  Error,
  Loader,
  TopControls,
  BottomControls,
  PlayPause,
} from './components';
import {_onEnd, _onBack} from './utils';
import {_styles} from './styles';
import {VideoPlayerProps} from './types';

const volumeWidth = 150;
const iconOffset = 0;

export const VideoPlayer = (props: VideoPlayerProps) => {
  const {
    toggleResizeModeOnFullscreen,
    controlAnimationTiming = 450,
    doubleTapTime = 130,
    resizeMode = 'contain',
    isFullscreen = false,
    showOnStart = false,
    paused = false,
    muted = false,
    volume = 1,
    title = '',
    rate = 1,
    showTimeRemaining = false,
    showHours = false,
    onError,
    onBack,
    onEnd,
    onEnterFullscreen = () => {},
    onExitFullscreen = () => {},
    onHideControls = () => {},
    onShowControls = () => {},
    onPause,
    onPlay,
    onLoad,
    onLoadStart,
    onProgress,
    controlTimeoutDelay = 15000,
    tapAnywhereToPause = false,
    videoStyle = {},
    style = {},
    seekColor = '',
    source,
    disableBack = false,
    disableVolume = false,
    disableFullscreen = false,
    disableTimer = false,
    disableSeekbar = false,
    disablePlayPause = false,
    navigator,
    videoRef,
  } = props;

  const mounted = useRef(false);
  const _videoRef = useRef<Video>(null);
  const controlTimeout = useRef<ReturnType<typeof setTimeout>>(
    setTimeout(() => {}),
  ).current;
  const tapActionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [_resizeMode, setResizeMode] = useState(resizeMode);
  const [_paused, setPaused] = useState(paused);
  const [_muted, setMuted] = useState(muted);
  const [_volume, setVolume] = useState(volume);
  const [_isFullscreen, setIsFullscreen] = useState(
    isFullscreen || resizeMode === 'cover' || false,
  );
  const [_showTimeRemaining, setShowTimeRemaining] =
    useState(showTimeRemaining);
  const [volumeTrackWidth, setVolumeTrackWidth] = useState(0);
  const [volumeFillWidth, setVolumeFillWidth] = useState(0);
  const [seekerFillWidth, setSeekerFillWidth] = useState(0);
  const [showControls, setShowControls] = useState(showOnStart);
  const [volumePosition, setVolumePositionState] = useState(0);
  const [seekerPosition, setSeekerPositionState] = useState(0);
  const [volumeOffset, setVolumeOffset] = useState(0);
  const [seekerOffset, setSeekerOffset] = useState(0);
  const [seekerWidth, setSeekerWidth] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);

  const toggleFullscreen = () => setIsFullscreen((prevState) => !prevState);
  const togglePlayPause = () => setPaused((prevState) => !prevState);
  const toggleControls = () => setShowControls((prevState) => !prevState);
  const toggleTimer = () => setShowTimeRemaining((prevState) => !prevState);

  const styles = {
    videoStyle,
    containerStyle: style,
  };

  const _onSeek = () => {
    if (!seeking) {
      setControlTimeout();
    }
  };

  const _onError = () => {
    setError(true);
    setLoading(false);
  };

  function _onLoadStart() {
    setLoading(true);

    if (typeof onLoadStart === 'function') {
      onLoadStart();
    }
  }

  function _onLoad(data: OnLoadData) {
    setDuration(data.duration);
    setLoading(false);

    if (showControls) {
      setControlTimeout();
    }

    if (typeof onLoad === 'function') {
      onLoad(data);
    }
  }

  function _onProgress(data: OnProgressData) {
    if (!seeking) {
      setCurrentTime(data.currentTime);

      if (typeof onProgress === 'function') {
        onProgress(data);
      }
    }
  }

  const _onScreenTouch = () => {
    if (tapActionTimeout.current) {
      clearTimeout(tapActionTimeout.current);
      tapActionTimeout.current = null;
      toggleFullscreen();
      if (showControls) {
        resetControlTimeout();
      }
    } else {
      tapActionTimeout.current = setTimeout(() => {
        if (tapAnywhereToPause && showControls) {
          togglePlayPause();
          resetControlTimeout();
        } else {
          toggleControls();
        }
        tapActionTimeout.current = null;
      }, doubleTapTime);
    }
  };

  const events = {
    onError: onError || _onError,
    onBack: (onBack || _onBack(navigator)) as () => void,
    onEnd: onEnd || _onEnd,
    onScreenTouch: _onScreenTouch,
    onEnterFullscreen,
    onExitFullscreen,
    onShowControls,
    onHideControls,
    onLoadStart: _onLoadStart,
    onProgress: _onProgress,
    onSeek: _onSeek,
    onLoad: _onLoad,
    onPause,
    onPlay,
  };

  const constrainToSeekerMinMax = useCallback(
    (val = 0) => {
      if (val <= 0) {
        return 0;
      } else if (val >= seekerWidth) {
        return seekerWidth;
      }
      return val;
    },
    [seekerWidth],
  );

  const constrainToVolumeMinMax = (val = 0) => {
    if (val <= 0) {
      return 0;
    } else if (val >= volumeWidth + 9) {
      return volumeWidth + 9;
    }
    return val;
  };

  const setSeekerPosition = useCallback(
    (position = 0) => {
      const positionValue = constrainToSeekerMinMax(position);
      setSeekerPositionState(positionValue);
      setSeekerOffset(positionValue);
      setSeekerFillWidth(positionValue);
    },
    [constrainToSeekerMinMax],
  );

  const setVolumePosition = (position = 0) => {
    const positionValue = constrainToVolumeMinMax(position);
    setVolumePositionState(positionValue + iconOffset);

    if (positionValue < 0) {
      setVolumeFillWidth(0);
    } else {
      setVolumeFillWidth(positionValue);
    }
  };

  const {animations, hideControlAnimation, showControlAnimation} =
    useAnimations(loading, controlAnimationTiming);

  const {clearControlTimeout, resetControlTimeout, setControlTimeout} =
    useControlTimeout({
      controlTimeout,
      controlTimeoutDelay,
      mounted: mounted.current,
      showControls,
      setShowControls,
    });

  const {volumePanResponder, seekPanResponder} = usePanResponders({
    duration,
    seekerOffset,
    volumeOffset,
    loading,
    seekerWidth,
    seeking,
    seekerPosition,
    seek: videoRef?.current?.seek,
    clearControlTimeout,
    setVolumePosition,
    setCurrentTime,
    setSeekerPosition,
    setSeeking,
    setControlTimeout,
    onEnd: events.onEnd,
  });

  useEffect(() => {
    if (toggleResizeModeOnFullscreen) {
      setResizeMode(_isFullscreen ? 'cover' : 'contain');
    }

    if (_isFullscreen) {
      typeof events.onEnterFullscreen === 'function' &&
        events.onEnterFullscreen();
    } else {
      typeof events.onExitFullscreen === 'function' &&
        events.onExitFullscreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_isFullscreen, toggleResizeModeOnFullscreen]);

  useEffect(() => {
    setIsFullscreen(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    setPaused(paused);
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [paused]);

  useEffect(() => {
    if (_paused) {
      typeof events.onPause === 'function' && events.onPause();
    } else {
      typeof events.onPlay === 'function' && events.onPlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_paused]);

  useEffect(() => {
    if (!seeking && currentTime && duration) {
      const percent = currentTime / duration;
      const position = seekerWidth * percent;

      setSeekerPosition(position);
    }
  }, [currentTime, duration, seekerWidth, seeking, setSeekerPosition]);

  useEffect(() => {
    if (showControls) {
      showControlAnimation();
      setControlTimeout();
      typeof events.onShowControls === 'function' && events.onShowControls();
    } else {
      hideControlAnimation();
      clearControlTimeout();
      typeof events.onHideControls === 'function' && events.onHideControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls]);

  useEffect(() => {
    const newVolume = volumePosition / volumeWidth;

    if (newVolume <= 0) {
      setMuted(true);
    } else {
      setMuted(false);
    }

    setVolume(newVolume);
    setVolumeOffset(volumePosition);

    const newVolumeTrackWidth = volumeWidth - volumeFillWidth;

    if (newVolumeTrackWidth > 150) {
      setVolumeTrackWidth(150);
    } else {
      setVolumeTrackWidth(newVolumeTrackWidth);
    }
  }, [volumeFillWidth, volumePosition]);

  useEffect(() => {
    const position = volumeWidth * _volume;
    setVolumePosition(position);
    setVolumeOffset(position);
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearControlTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TouchableWithoutFeedback
      onPress={events.onScreenTouch}
      style={[_styles.player.container, styles.containerStyle]}>
      <SafeAreaView style={[_styles.player.container, styles.containerStyle]}>
        <Video
          {...props}
          {...events}
          ref={videoRef || _videoRef}
          // resizeMode={_resizeMode}
          volume={_volume}
          paused={_paused}
          muted={_muted}
          rate={rate}
          style={[_styles.player.video, styles.videoStyle]}
          source={source}
        />
        <Error error={error} />
        <Loader loading={loading} animations={animations} />
        <TopControls
          panHandlers={volumePanResponder.panHandlers}
          animations={animations}
          disableBack={disableBack}
          disableVolume={disableVolume}
          volumeFillWidth={volumeFillWidth}
          volumeTrackWidth={volumeTrackWidth}
          volumePosition={volumePosition}
          onBack={events.onBack}
          resetControlTimeout={resetControlTimeout}
        />
        <PlayPause
          animations={animations}
          disablePlayPause={disablePlayPause}
          paused={_paused}
          togglePlayPause={togglePlayPause}
          resetControlTimeout={resetControlTimeout}
          showControls={showControls}
        />
        <BottomControls
          animations={animations}
          panHandlers={seekPanResponder.panHandlers}
          disableTimer={disableTimer}
          disableSeekbar={disableSeekbar}
          showHours={showHours}
          paused={_paused}
          showTimeRemaining={_showTimeRemaining}
          currentTime={currentTime}
          duration={duration}
          seekColor={seekColor}
          title={title}
          toggleTimer={toggleTimer}
          resetControlTimeout={resetControlTimeout}
          seekerFillWidth={seekerFillWidth}
          seekerPosition={seekerPosition}
          setSeekerWidth={setSeekerWidth}
          isFullscreen={isFullscreen}
          disableFullscreen={disableFullscreen}
          toggleFullscreen={toggleFullscreen}
        />
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};