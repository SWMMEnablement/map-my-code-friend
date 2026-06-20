export const SAMPLE_INP = `[TITLE]
Example SWMM5 Model - Small Urban Catchment

[OPTIONS]
FLOW_UNITS           CFS
INFILTRATION         HORTON
FLOW_ROUTING         KINWAVE
START_DATE           01/01/2024
START_TIME           00:00:00
END_DATE             01/01/2024
END_TIME             06:00:00
REPORT_STEP          00:05:00
WET_STEP             00:05:00
DRY_STEP             01:00:00
ROUTING_STEP         0:00:30

[RAINGAGES]
;;Name           Format    Interval SCF      Source
RG1              INTENSITY 0:05     1.0      TIMESERIES TS1

[SUBCATCHMENTS]
;;Name   Rain_Gage  Outlet  Area  %Imperv  Width  Slope  CurbLen
S1       RG1        J1      5.0   60       500    0.5    0
S2       RG1        J2      3.5   45       400    0.8    0
S3       RG1        J3      4.2   70       450    0.6    0

[JUNCTIONS]
;;Name  Elevation  MaxDepth  InitDepth  SurDepth  Aponded
J1      96.0       4.0       0          0         0
J2      94.0       4.0       0          0         0
J3      92.0       4.0       0          0         0
J4      90.0       4.0       0          0         0

[OUTFALLS]
;;Name  Elevation  Type    Stage_Data  Gated
OUT1    88.0       FREE                NO

[CONDUITS]
;;Name  From  To    Length  Roughness  InOffset  OutOffset
C1      J1    J2    400     0.013      0         0
C2      J2    J3    400     0.013      0         0
C3      J3    J4    400     0.013      0         0
C4      J4    OUT1  100     0.013      0         0

[XSECTIONS]
;;Link  Shape      Geom1  Geom2  Geom3  Geom4  Barrels
C1      CIRCULAR   1.5    0      0      0      1
C2      CIRCULAR   1.5    0      0      0      1
C3      CIRCULAR   2.0    0      0      0      1
C4      CIRCULAR   2.0    0      0      0      1

[TIMESERIES]
;;Name  Date  Time  Value
TS1           0:00  0.0
TS1           0:15  1.2
TS1           0:30  2.5
TS1           0:45  1.8
TS1           1:00  0.6
TS1           1:30  0.0
`;
