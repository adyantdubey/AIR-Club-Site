// Edit project content here. `featured: true` shows the live 3D rover instead of an image.
export const projects = [
  {
    id: 'irc-rover',
    tag: 'AUTONOMY',
    title: 'IRC 2027 Rover',
    blurb:
      'Six-wheel rocker-bogie rover built for the International Rover Challenge. GPS-denied navigation with LiDAR, visual odometry and a robotic arm.',
    tech: ['ROS 2', 'Jetson', 'YDLIDAR', 'PX4FLOW', 'goBILDA'],
    featured: true,
    hue: 220,
  },
  {
    id: 'vital-vision',
    tag: 'COMPUTER VISION',
    title: 'Vision Vital Monitor',
    blurb:
      'A camera-based device that reads bedside patient monitors and streams vitals to a dashboard — no wiring into the hospital equipment.',
    tech: ['OpenCV', 'ESP32', 'OCR', 'MQTT'],
    hue: 205,
  },
  {
    id: 'snn-chip',
    tag: 'NEUROMORPHIC',
    title: 'Spiking Neural Processor',
    blurb:
      'A digital spiking-neural-network core on FPGA that runs event-driven inference at a fraction of the power of a GPU.',
    tech: ['Verilog', 'FPGA', 'SNN', 'ASIC flow'],
    hue: 235,
  },
  {
    id: 'line-bot',
    tag: 'EMBEDDED',
    title: 'Line-Follower Bot',
    blurb:
      'Our freshers\' starter project: PID-controlled line follower that finishes the track in under 12 seconds.',
    tech: ['Arduino', 'PID', 'IR sensors'],
    hue: 215,
  },
  {
    id: 'drone',
    tag: 'AERIAL',
    title: 'Autonomous Drone',
    blurb:
      'Quadcopter with onboard object tracking and waypoint missions, used for campus mapping.',
    tech: ['PX4', 'MAVLink', 'YOLO', 'Raspberry Pi'],
    hue: 200,
  },
];
