/**
 *
 * Gridfinity Generator for Onshape
 * ================================
 *
 * Author: Jose Galarza (@igalarzab)
 * <https://x.com/igalarzab>
 *
 * You can submit bugs and feature requests in:
 * <https://github.com/igalarzab/gridfinity-generator-onshape>
 *
 * Gridfinity is an original idea developed by Zach Freedman
 * <https://www.youtube.com/@ZackFreedman>
 *
 * Gridfinity Specifications thanks to @Stu142
 * <https://github.com/Stu142/Gridfinity-Documentation>
 *
 * This work is licensed under Creative Commons Attribution-ShareAlike 4.0
 * <https://creativecommons.org/licenses/by-sa/4.0/>
 *
 */

FeatureScript 2656;

import(path: 'onshape/std/common.fs', version: '2656.0');
import(path: 'onshape/std/geometry.fs', version: '2656.0');

icon::import(path: 'ee93c9c076a700a661adcd6f', version: 'cc6e67e2b4cf4e6ce87b92f5');


/**
 *
 * Dimensions.
 *
 * You can change any of these dimensions to modify your bin, but doing so will make
 * your part to be not-Gridfinity compliant
 *
 */

const Dims = {
    unitSize: 42 * millimeter,
    unitHeight: 7 * millimeter,
    unitSeparator: 0.25 * millimeter,

    baseFillet: 0.8 * millimeter,
    baseHoleClearance: 4.8 * millimeter,
    baseDraftAngle: 45 * degree,
    baseLayer1Height: 0.8 * millimeter,
    baseLayer2Height: 1.8 * millimeter,
    baseLayer3Height: 2.15 * millimeter,
    baseLayer4Height: 2.25 * millimeter,

    bodyFillet: 3.75 * millimeter,
    bodyInternalFillet: 2.55 * millimeter,

    topHeight: 4.4 * millimeter,
    topStackableLipWidth: 2.6 * millimeter,
    topStackableLipHeight: 5.8 * millimeter,
    topStackableLipRoundedFillet: 0.5 * millimeter,
};


/**
 *
 * Global Variables.
 *
 */

export enum TopLipShape {
    SHARP, ROUNDED
}


export enum FillType {
    COMPLETE, UNTIL_LIP
}


export enum FingerSlideType {
    CHAMFER, ROUNDED
}


enum Orientation {
    TOP, BOTTOM, LEFT, RIGHT, FRONT, BACK
}


const Planes = {
    top: qCreatedBy(makeId('Top'), EntityType.FACE),
    right: qCreatedBy(makeId('Right'), EntityType.FACE),
    front: qCreatedBy(makeId('Front'), EntityType.FACE),
};


// Ranges -> (min, default, max)
const UNIT_HEIGHT_RANGE = [3, 6, 50];
const MAGNETS_RADIUS_RANGE = [0.5, 3.25, 4.25];
const MAGNETS_DEPTH_RANGE = [0.5, 2.4, 4];
const LABEL_WIDTH_RANGE = [1, 13, 100];
const LABEL_OFFSET_RANGE = [0, 0.5, 100];
const BODY_WALL_THICKNESS_RANGE = [1.2, 1.6, 10];
const FINGER_SLIDE_HEIGHT_RANGE = [2, 10, 15];


// Sweep contour for each lid type (in mm)
const LID_SWEEP = {
    TopLipShape.SHARP: {
        x: [-2.6, 4.4, 2.5, 0.7, 0.0, -2.6],
        y: [ 0.0, 0.0, 1.9, 1.9, 2.6,  0.0],
    },
    TopLipShape.ROUNDED: {
        x: [-2.6, 4.4,  4.4, 3.05, 1.25, 0.55,  0.0, -2.6],
        y: [ 0.0, 0.0, 0.55,  1.9,  1.9,  2.6,  2.6,  0.0],
    }
};


/**
 *
 * Feature Definition
 *
 */

annotation { 'Feature Type Name' : 'Gridfinity Bin', 'Feature Type Description' : 'Create a gridfinity bin', 'Icon': icon::BLOB_DATA }
export const gridfinityBin = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { 'Group Name' : 'Dimensions', 'Collapsed By Default' : false }
        {
            annotation { 'Name' : 'Rows', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.rows, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Columns', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.columns, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Height', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.height, { (unitless) : UNIT_HEIGHT_RANGE } as IntegerBoundSpec);
        }

        annotation { 'Name' : 'Add Magnets', 'Default': true }
        definition.magnets is boolean;

        if (definition.magnets) {
            annotation { 'Group Name' : '', 'Collapsed By Default' : true, 'Driving Parameter' : 'magnets' }
            {
                annotation { 'Name' : 'Radius' }
                isLength(definition.baseMagnetRadius, { (millimeter): MAGNETS_RADIUS_RANGE } as LengthBoundSpec);

                annotation { 'Name' : 'Depth' }
                isLength(definition.baseMagnetDepth, { (millimeter): MAGNETS_DEPTH_RANGE } as LengthBoundSpec);
            }
        }

        annotation { 'Name' : 'Fill the bin' }
        definition.filled is boolean;

        if (definition.filled) {
            annotation { 'Group Name' : '', 'Collapsed By Default' : false, 'Driving Parameter' : 'filled' }
            {
                annotation { 'Name' : 'Type', 'Default': FillType.UNTIL_LIP }
                definition.fillType is FillType;
            }
        }

        if (!definition.filled || (definition.filled && definition.fillType == FillType.UNTIL_LIP)) {
            annotation { 'Name' : 'Add Stackable Lip', 'Default': true }
            definition.stackableLip is boolean;

            if (definition.stackableLip) {
                annotation { 'Group Name' : '', 'Collapsed By Default' : true, 'Driving Parameter' : 'stackableLip' }
                {
                    annotation { 'Name' : 'Shape', 'Default': TopLipShape.SHARP }
                    definition.lipShape is TopLipShape;
                }
            }
        }

        if (!definition.filled) {
            annotation { 'Name' : 'Add Label', 'Default': true }
            definition.label is boolean;

            if (definition.label) {
                annotation { 'Group Name' : '', 'Collapsed By Default' : true, 'Driving Parameter' : 'label' }
                {
                    annotation { 'Name' : 'Width' }
                    isLength(definition.labelWidth, { (millimeter): LABEL_WIDTH_RANGE } as LengthBoundSpec);

                    annotation { 'Name' : 'Offset' }
                    isLength(definition.labelOffset, { (millimeter): LABEL_OFFSET_RANGE } as LengthBoundSpec);
                }
            }

            annotation { 'Name' : 'Add Finger Slide', 'Default': true }
            definition.fingerSlide is boolean;

            if (definition.fingerSlide) {
                annotation { 'Group Name' : '', 'Collapsed By Default' : true, 'Driving Parameter' : 'fingerSlide' }
                {
                    annotation { 'Name' : 'Shape', 'Default': FingerSlideType.ROUNDED }
                    definition.fingerSlideType is FingerSlideType;

                    annotation { 'Name' : 'Height' }
                    isLength(definition.fingerSlideHeight, { (millimeter): FINGER_SLIDE_HEIGHT_RANGE } as LengthBoundSpec);
                }
            }
        }

        annotation { 'Group Name' : 'Advanced Config', 'Collapsed By Default' : true }
        {
            annotation { 'Name' : 'Wall Thicknes', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isLength(definition.bodyWallThicknes, { (millimeter): BODY_WALL_THICKNESS_RANGE } as LengthBoundSpec);
        }
    }
    {
        // Create the base parts
        const base = baseCreate(context, definition, id + 'Base');
        const body = bodyCreate(context, definition, id + 'Body', base);
        const top = topCreate(context, definition, id + 'Top', body);

        // Merge the base parts in one part
        mergeParts(context, id + 'BaseBin', [base, body, top]);

        // Create the finger slide if needed
        if (!definition.filled && definition.fingerSlide) {
            const fingerSlide = fingerSlideCreate(context, definition, id + 'FingerSlide', base);
        }

        // Create the label if needed
        if (!definition.filled && definition.label) {
            const label = labelCreate(context, definition, id + 'Label', base);
            mergeParts(context, id + 'BaseBinWithLabel', [base, label]);
        }

        // Center the bin in the origin
        centerPart(context, id + 'Center', base.id);

        // Rename the bin
        renamePart(context, base.id, 'Gridfinity Bin ' ~ definition.rows ~ 'x' ~ definition.columns);
    }
);


/**
 *
 * Functions to create the base of the bin
 *
 */

function baseCreate(context is Context, definition is map, id is Id) {
    const baseSketch = baseSketch(context, definition, id + 'Sketch');

    // Create the 3 layers of the base
    const layer1Extrude = wallExtrude(context, id + 'Layer1', baseSketch.region, {
        depth: Dims.baseLayer1Height,
        filletRadius: Dims.baseFillet,
        draftAngle: Dims.baseDraftAngle,
    });

    const layer2Extrude = wallExtrude(context, id + 'Layer2', findFace(context, layer1Extrude.id, Orientation.TOP), {
        depth: Dims.baseLayer2Height,
    });

    const layer3Extrude = wallExtrude(context, id + 'Layer3', findFace(context, layer2Extrude.id, Orientation.TOP), {
        depth: Dims.baseLayer3Height,
        draftAngle: Dims.baseDraftAngle,
    });

    // Merge the three layers into a single part
    const basePart = mergeParts(context, id + 'BasePart', [
        layer1Extrude,
        layer2Extrude,
        layer3Extrude,
    ]);

    // Create the magnet holes if needed
    if (definition.magnets) {
        const holesSketch = baseMagnetHolesSketch(context, id + 'Magnets', definition, basePart);

        const magnets = wallExtrude(context, id + 'MagnetsExtrude', holesSketch.region, {
            depth: definition.baseMagnetDepth,
        });

        substractParts(context, id + 'MagnetsHole', basePart.id, [magnets.id]);
        removeBodies(context, id + 'DeleteMagnetsSketch', [holesSketch.id]);
    }

    // Replicate the base for rows * columns
    var linearPatternId = undefined;
    if (definition.rows > 1 || definition.columns > 1) {
        linearPatternId = id + 'ReplicateBases';

        linearPattern(context, linearPatternId, {
            'patternType': PatternType.PART,
            'entities': qCreatedBy(basePart.id, EntityType.BODY),
            'hasSecondDir': true,
            'oppositeDirectionTwo': true,
            'directionOne': Planes.right,
            'directionTwo': Planes.front,
            'distance': Dims.unitSize,
            'distanceTwo': Dims.unitSize,
            'instanceCount': definition.columns,
            'instanceCountTwo': definition.rows,
        });
    }

    // Layer 4 is common to all the bases, that's why we do it after the linearPattern
    const layer4Sketch = baseLayer4Sketch(
        context,
        definition,
        id + 'Layer4Sketch',
        layer3Extrude
    );

    const layer4Extrude = wallExtrude(context, id + 'Layer4Extrude', layer4Sketch.region, {
        depth: Dims.baseLayer4Height,
        filletRadius: Dims.bodyFillet,
    });

    // Merge all the bases into a single part
    mergeParts(context, id + 'AllBases', [
        basePart,
        { 'id': linearPatternId },
        layer4Extrude,
    ]);

    // Remove sketches, they are not needed anymore
    removeBodies(context, id + 'DeleteBaseSketches', [baseSketch.id, layer4Sketch.id]);

    return { 'id': basePart.id, 'layer4Id': layer4Extrude.id };
}


function baseSketch(context is Context, definition is map, id is Id) {
    const sketchId = id + 'Sketch';

    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : Planes.top,
    });

    const bottomSize = baseCalculateBottomSize();

    skRectangle(sketch, 'bottomSketchRectangle', {
        'firstCorner': vector(0, 0) * millimeter,
        'secondCorner': vector(bottomSize, bottomSize)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseMagnetHolesSketch(context is Context, id is Id, definition is map, base is map) {
    const sketchId = id + 'Sketch';

    // Create a plane in the center of the base to make maths for the magnets simpler
    const tangentPlane = evFaceTangentPlane(context, {
        'face': findFace(context, base.id, Orientation.BOTTOM),
        'parameter': vector(0.5, 0.5),
    });

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : tangentPlane,
    });

    const bottomSize = baseCalculateBottomSize();
    const x =  (bottomSize / 2) - Dims.baseHoleClearance;
    const y = -(bottomSize / 2) + Dims.baseHoleClearance;

    skCircle(sketch, 'topRight',    { 'center' : vector(x, x), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'bottomRight', { 'center' : vector(x, y), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'topLeft',     { 'center' : vector(y, x), 'radius' : definition.baseMagnetRadius });
    skCircle(sketch, 'bottomLeft',  { 'center' : vector(y, y), 'radius' : definition.baseMagnetRadius });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseLayer4Sketch(context is Context, definition is map, id is Id, layer3Extrude is map) {
    const sketchId = id + 'Sketch';

    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : findFace(context, layer3Extrude.id, Orientation.TOP)
    });

    const initXY = -baseCalculateOffset();
    const endX = initXY + (Dims.unitSize * definition.columns) - (Dims.unitSeparator * 2);
    const endY = initXY + (Dims.unitSize * definition.rows) - (Dims.unitSeparator * 2);

    skRectangle(sketch, 'rectangle', {
        'firstCorner': vector(initXY, initXY),
        'secondCorner': vector(endX, endY)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


function baseCalculateBottomSize() {
    return Dims.unitSize - ((Dims.baseLayer1Height + Dims.baseLayer3Height + Dims.unitSeparator) * 2);
}


function baseCalculateOffset() {
    return Dims.baseLayer1Height + Dims.baseLayer3Height;
}


/**
 *
 * Functions to create the body of the bin
 *
 */

function bodyCreate(context is Context, definition is map, id is Id, base is map) {
    const topFace = findFace(context, base.layer4Id, Orientation.TOP);

    const bodyExtrude = wallExtrude(context, id + 'Body', topFace, {
        depth: Dims.unitHeight * (definition.height - 1),
    });

    if (!definition.filled) {
        const sketch = bodyHollowSketch(context, definition, id + 'Body', base);

        const hollowExtrude = wallExtrude(context, id + 'Hollow', sketch.region, {
            depth: Dims.unitHeight * (definition.height - 1),
            filletRadius: Dims.bodyInternalFillet,
        });

        substractParts(context, id, bodyExtrude.id, [hollowExtrude.id]);
        removeBodies(context, id + 'DeleteBodyHollowSketch', [sketch.id]);
    }

    return { 'id': bodyExtrude.id };
}


function bodyHollowSketch(context is Context, definition is map, id is Id, base is map) {
    const sketchId = id + 'Sketch';

    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : findFace(context, base.layer4Id, Orientation.TOP)
    });

    var fingerSlideOffset = 0 * millimeter;

    if (definition.fingerSlide) {
        fingerSlideOffset = max(0 * millimeter, Dims.topStackableLipWidth - definition.bodyWallThicknes);
    }

    const offset = -baseCalculateOffset();

    const initX = offset + definition.bodyWallThicknes;
    const initY = offset + definition.bodyWallThicknes + fingerSlideOffset;
    const endX  = offset - definition.bodyWallThicknes + (Dims.unitSize * definition.columns) - (Dims.unitSeparator * 2);
    const endY  = offset - definition.bodyWallThicknes + (Dims.unitSize * definition.rows) - (Dims.unitSeparator * 2);

    skRectangle(sketch, 'rectangle', {
        'firstCorner': vector(initX, initY),
        'secondCorner': vector(endX, endY)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


/**
 *
 * Functions to create the top of the bin
 *
 */

function topCreate(context is Context, definition is map, id is Id, body is map) {
    const topFace = findFace(context, body.id, Orientation.TOP);
    const topId = id + 'Top';

    // If there is no stackable lip or the bin should be filled completely, we just extrude the top
    if (!definition.stackableLip || (definition.filled && definition.fillType == FillType.COMPLETE)) {
        wallExtrude(context, topId, topFace, {
            'depth': Dims.topHeight,
        });

        return { 'id': topId };
    }

    // Otherwise we prepare the sweep to create the lid
    const lipSketch = topLipSketch(context, definition, id + 'Lip', body);
    const topLoop = qIntersection(qCreatedBy(body.id, EntityType.EDGE), qLoopEdges(topFace));

    opSweep(context, topId, {
        'profiles': lipSketch.region,
        'path': topLoop,
    });

    // The rounded shape needs a fillet
    if (definition.lipShape == TopLipShape.ROUNDED) {
        const lipLoop = qLoopEdges(findFace(context, topId, Orientation.TOP));
        const leftFaceLoop = qLoopEdges(findFace(context, topId, Orientation.LEFT));
        const lipLeftEdge = qIntersection(lipLoop, leftFaceLoop);

        opFillet(context, id + 'TopFillet', {
           'entities': lipLeftEdge,
            'radius' : Dims.topStackableLipRoundedFillet,
            'tangentPropagation': true,
        });
    }

    removeBodies(context, id + 'DeleteLipSketch', [lipSketch.id]);

    return { 'id': topId };
}


function topLipSketch(context is Context, definition is map, id is Id, top is map) {
    const sketchId = id + 'Sketch';

    const tangentPlane = evFaceTangentPlane(context, {
        'face': findFace(context, top.id, Orientation.TOP),
        'parameter': vector(0.5, 0)
    });

    // We need a plane perpendicular to the lid to create the sketch for the sweep
    const perpendicularPlane = plane(
        tangentPlane.origin,
        -tangentPlane.x,
        tangentPlane.normal
    );

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : perpendicularPlane
    });

    const x = LID_SWEEP[definition.lipShape]['x'];
    const y = LID_SWEEP[definition.lipShape]['y'];

    for (var i = 0; i != size(x)-1; i += 1) {
        skLineSegment(sketch, 'Line' ~ i, {
            'start' : vector(x[i], y[i]) * millimeter,
            'end' : vector(x[i+1], y[i+1]) * millimeter
        });
    }

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


/**
 *
 * Functions to create the label
 *
 */

function labelCreate(context is Context, definition is map, id is Id, base is map) {
    const extrudeId = id + 'LabelExtrude';

    const labelSketch = labelSketch(context, definition, id + 'LabelSketch', base);
    const rightFace = findFace(context, base.layer4Id, Orientation.RIGHT);

    opExtrude(context, extrudeId, {
        'entities' : labelSketch.region,
        'direction' : evPlane(context, {'face' : Planes.right}).normal,
        'endBound' : BoundingType.UP_TO_FACE,
        'endBoundEntity' : rightFace
    });

    removeBodies(context, id + 'DeleteLabelSketch', [labelSketch.id]);

    return { 'id': extrudeId };
}


function labelSketch(context is Context, definition is map, id is Id, base is map) {
    const sketchId = id + 'Sketch';
    const internalLoop = qLoopEdges(findFace(context, base.layer4Id, Orientation.TOP));

    const frontAndBackEdges = qParallelEdges(
        internalLoop,
        evPlane(context, {'face' : Planes.front}).x
    );

    const backEdge = findExtremeEdge(context, frontAndBackEdges, Orientation.BACK);
    const backLine = evEdgeTangentLine(context, { 'edge': backEdge, 'parameter': 0 });

    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : plane(
            backLine.origin - vector(Dims.bodyInternalFillet, 0 * millimeter, 0 * millimeter),
            evPlane(context, {'face' : Planes.right}).normal
        )
    });

    var heightToTop = ((definition.height - 1) * Dims.unitHeight) + Dims.topHeight;

    if (definition.stackableLip) {
        heightToTop = heightToTop - Dims.topStackableLipHeight;
    }

    skSafeOverhangTriangle(
        sketch,
        0 * millimeter,
        heightToTop - definition.labelOffset,
        -definition.labelWidth
    );

    skSolve(sketch);

    return { 'id': sketchId, 'region': qSketchRegion(sketchId, false) };
}


/**
 *
 * Functions to create the finger slide
 *
 */

function fingerSlideCreate(context is Context, definition is map, id is Id, base is map) {
    const internalLoop = qLoopEdges(findFace(context, base.layer4Id, Orientation.TOP));

    const frontAndBackEdges = qParallelEdges(
        internalLoop,
        evPlane(context, {'face' : Planes.front}).x
    );

    const frontEdge = findExtremeEdge(context, frontAndBackEdges, Orientation.FRONT);

    if (definition.fingerSlideType == FingerSlideType.ROUNDED) {
        opFillet(context, id + 'TopFillet', {
           'entities': frontEdge,
            'radius' : definition.fingerSlideHeight,
            'tangentPropagation': false,
        });
    } else if (definition.fingerSlideType == FingerSlideType.CHAMFER) {
        opChamfer(context, id + 'To', {
            'entities' : frontEdge,
            'chamferType' : ChamferType.EQUAL_OFFSETS,
            'width' : definition.fingerSlideHeight,
        });
    } else {
        throw 'FingerSlideType not implemented: ' ~ definition.fingerSlideType;
    }
}


/**
 *
 * Helper functions
 *
 */

function skSafeOverhangTriangle(sketch is Sketch, point0 is ValueWithUnits, point1 is ValueWithUnits, point2 is ValueWithUnits) {
    skLineSegment(sketch, 'Line' ~ 1, {
        'start' : vector(point0, point1),
        'end' : vector(point2, point1)
    });

    skLineSegment(sketch, 'Line' ~ 2, {
        'start' : vector(point2, point1),
        'end' : vector(point0, point0 + point1 + point2)
    });

    skLineSegment(sketch, 'Line' ~ 3, {
        'start' : vector(point0, point0 + point1 + point2),
        'end' : vector(point0, point1)
    });
}


function wallExtrude(context is Context, id is Id, face is Query, config is map) {
    const extrudeId = id + 'Extrude';

    opExtrude(context, extrudeId, {
        'entities' : face,
        'direction' : evPlane(context, {'face' : Planes.top}).normal,
        'endBound' : BoundingType.BLIND,
        'endDepth' : config.depth
    });

    if (config.filletRadius != undefined) {
        const edges = qParallelEdges(
            qCreatedBy(id, EntityType.EDGE),
            evPlane(context, {'face' : Planes.top}).normal
        );

        opFillet(context, id + 'Fillet', {
            'entities' : edges,
            'radius' : config.filletRadius
        });
    }

    if (config.draftAngle != undefined) {
        const rightFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.right})
        );

        const frontFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.front})
        );

        opDraft(context, id + 'Draft', {
            'draftType' : DraftType.REFERENCE_SURFACE,
            'draftFaces' : qUnion(rightFaces, frontFaces),
            'referenceSurface': face,
            'pullVec' : vector(0, 0, -1),
            'angle' : config.draftAngle
        });
    }

    return { 'id': extrudeId };
}


function mergeParts(context is Context, id is Id, parts is array) {
    var finalParts = [];
    var firstPartId = undefined;

    for (var part in parts) {
        if (part != undefined && part.id != undefined) {
            finalParts = append(finalParts, qCreatedBy(part.id, EntityType.BODY));

            if (firstPartId == undefined) {
                firstPartId = part.id;
            }
        }
    }

    opBoolean(context, id + 'Union', {
        operationType: BooleanOperationType.UNION,
        tools: qUnion(finalParts)
    });

    // In an union, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
}


function substractParts(context is Context, id is Id, targetId is Id, partIds is array) {
    var parts = [];
    var firstPartId = undefined;

    for (var partId in partIds) {
        if (partId != undefined) {
            parts = append(parts, qCreatedBy(partId, EntityType.BODY));

            if (firstPartId == undefined) {
                firstPartId = partId;
            }
        }
    }

    opBoolean(context, id + 'Substract', {
        operationType: BooleanOperationType.SUBTRACTION,
        targets: qCreatedBy(targetId, EntityType.BODY),
        tools: qUnion(parts)
    });

    // In a removal, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
}


function findFace(context is Context, id is Id, face is Orientation) {
    const allFaces = evaluateQuery(context, qCreatedBy(id, EntityType.FACE));
    var vectorValue = undefined;

    if (face == Orientation.TOP) {
        vectorValue = vector(0, 0, 1);
    } else if (face == Orientation.BOTTOM) {
        vectorValue = vector(0, 0, -1);
    } else if (face == Orientation.LEFT) {
        vectorValue = vector(-1, 0, 0);
    } else if (face == Orientation.RIGHT) {
        vectorValue = vector(1, 0, 0);
    } else {
        throw 'Orientation not implemented: ' ~ face;
    }

    for (var f in allFaces) {
        const plane = evFaceTangentPlane(context, { 'face': f, parameter: vector(0.5, 0.5) });

        if (plane.normal == vectorValue) {
            return f;
        }
    }

    debug(context, 'No ' ~ face ~ ' face found for ' ~ id, DebugColor.RED);
    debug(context, allFaces);

    return undefined;
}


function findExtremeEdge(context is Context, edgeQuery is Query, direction is Orientation) returns Query {
    const edges = evaluateQuery(context, edgeQuery);

    const directionMap = {
        Orientation.LEFT:   { 'dimension': 0, 'minimize': false },
        Orientation.RIGHT:  { 'dimension': 0, 'minimize': true },
        Orientation.BACK:   { 'dimension': 1, 'minimize': false },
        Orientation.FRONT:  { 'dimension': 1, 'minimize': true },
        Orientation.BOTTOM: { 'dimension': 2, 'minimize': false },
        Orientation.TOP:    { 'dimension': 2, 'minimize': true }
    };

    const dim = directionMap[direction].dimension;
    const minimize = directionMap[direction].minimize;

    if (dim == undefined || minimize == undefined) {
        throw 'Direction not implemented ' ~ direction;
    }

    var bestPoint = (minimize ? inf : -inf) * millimeter;
    var bestEdge = undefined;

    for (var edge in edges) {
        const midPoint = evEdgeTangentLine(context, {
            'edge': edge,
            'parameter': 0.5
        }).origin[dim];

        if ((minimize && midPoint < bestPoint) || (!minimize && midPoint > bestPoint)) {
            bestPoint = midPoint;
            bestEdge = edge;
        }
    }

    return bestEdge == undefined ? qNothing() : qUnion([bestEdge]);
}


function removeBodies(context is Context, id is Id, idsToRemove is array) {
    var finalIds = [];

    for (var idToRemove in idsToRemove) {
        if (idToRemove != undefined) {
            finalIds = append(finalIds, qCreatedBy(idToRemove, EntityType.BODY));
        }
    }

    opDeleteBodies(context, id + 'DeleteBodies', {
        entities: qUnion(finalIds)
    });
}


function centerPart(context is Context, id is Id, partId is Id) {
    const part = qCreatedBy(partId, EntityType.BODY);

    const boxPart = evBox3d(context, {
        'topology': qCreatedBy(partId, EntityType.BODY)
    });

    var center = 0.5 * (boxPart.minCorner + boxPart.maxCorner);
    center[2] = 0 * millimeter;

    opTransform(context, id + 'MoveToOrigin', {
        'bodies': part,
        'transform': transform(-center)
    });
}


function renamePart(context is Context, id is Id, name is string) {
    setProperty(context, {
        'entities' : qCreatedBy(id, EntityType.BODY),
        'propertyType' : PropertyType.NAME,
        'value' : name
    });
}